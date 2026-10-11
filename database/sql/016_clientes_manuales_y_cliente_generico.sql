-- 016_clientes_manuales_y_cliente_generico.sql
-- Alta manual controlada de DNI y normalización de Cliente varios.
-- Ejecutar manualmente después de 015.

begin;

do $$
begin
  if exists (
    select 1
    from public.schema_change_log
    where script_code = '016'
  ) then
    raise exception 'El script 016 ya fue aplicado.';
  end if;

  if not exists (
    select 1
    from public.schema_change_log
    where script_code = '015'
  ) then
    raise exception 'Debe ejecutar primero 015_motor_transaccional_ventas.sql.';
  end if;
end
$$;

alter table public.customers
  add column if not exists verification_source text not null default 'legacy',
  add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_verification_source_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_verification_source_check
      check (verification_source in ('legacy', 'apiperu', 'manual'));
  end if;
end
$$;

create or replace function public.create_customer(
  p_organization_id uuid,
  p_document_type text,
  p_document_number text,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_id uuid;
  v_doc text := trim(p_document_number);
  v_name text := trim(p_name);
begin
  if auth.uid() is null
     or not public.is_org_member(p_organization_id) then
    raise exception 'No tiene acceso a la organización.';
  end if;

  if p_document_type not in ('1', '6') then
    raise exception 'Tipo de documento inválido.';
  end if;

  if (
    p_document_type = '1'
    and v_doc !~ '^[0-9]{8}$'
  ) or (
    p_document_type = '6'
    and v_doc !~ '^[0-9]{11}$'
  ) then
    raise exception 'Número de documento inválido.';
  end if;

  if length(v_name) < 2 then
    raise exception 'Nombre o razón social inválido.';
  end if;

  insert into public.customers (
    organization_id,
    document_type,
    document_number,
    name,
    phone,
    email,
    address,
    verification_source,
    verified_at,
    created_by
  )
  values (
    p_organization_id,
    p_document_type,
    v_doc,
    v_name,
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), ''),
    nullif(trim(p_address), ''),
    'apiperu',
    now(),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_manual_customer(
  p_organization_id uuid,
  p_document_number text,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_id uuid;
  v_doc text := trim(p_document_number);
  v_name text := trim(p_name);
begin
  if auth.uid() is null
     or not public.is_org_member(p_organization_id) then
    raise exception 'No tiene acceso a la organización.';
  end if;

  if v_doc !~ '^[0-9]{8}$' then
    raise exception 'El alta manual solo admite DNI de 8 dígitos.';
  end if;

  if length(v_name) < 2 then
    raise exception 'Nombre inválido.';
  end if;

  insert into public.customers (
    organization_id,
    document_type,
    document_number,
    name,
    phone,
    email,
    address,
    verification_source,
    verified_at,
    created_by
  )
  values (
    p_organization_id,
    '1',
    v_doc,
    v_name,
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), ''),
    nullif(trim(p_address), ''),
    'manual',
    null,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_customer(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_customer(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

revoke all on function public.create_manual_customer(
  uuid,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_manual_customer(
  uuid,
  text,
  text,
  text,
  text,
  text
) to authenticated;

comment on column public.customers.verification_source is
  'Origen del dato del cliente: apiperu, manual o legacy.';

comment on column public.customers.verified_at is
  'Fecha en que el documento fue verificado con la fuente indicada. NULL para altas manuales/legacy.';

comment on function public.create_manual_customer(
  uuid,
  text,
  text,
  text,
  text,
  text
) is
  'Alta manual controlada para DNI que ApiPeru no encuentra. No admite RUC.';

create or replace function public.create_pos_sale(
  p_session_id uuid,
  p_document_type text,
  p_series text,
  p_customer_id uuid default null,
  p_items jsonb default '[]'::jsonb,
  p_payment_method text default 'cash',
  p_received_amount numeric default null
)
returns table (
  sale_id uuid,
  series text,
  correlative bigint,
  taxable_amount numeric,
  igv_amount numeric,
  total_amount numeric,
  change_amount numeric
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_session public.sales_sessions%rowtype;
  v_customer public.customers%rowtype;
  v_sale_id uuid;
  v_correlative bigint;
  v_taxable numeric;
  v_igv numeric;
  v_total numeric;
  v_received numeric(12,2);
  v_change numeric(12,2) := 0;
begin
  select *
  into v_session
  from public.sales_sessions
  where id = p_session_id
    and status = 'open';

  if not found then
    raise exception 'No existe una sesión de venta abierta.';
  end if;

  if not public.can_access_branch(
    v_session.organization_id,
    v_session.branch_id
  ) then
    raise exception 'No tiene acceso a la sesión.';
  end if;

  if auth.uid() <> v_session.cashier_user_id
     and not public.is_org_owner(v_session.organization_id) then
    raise exception 'La sesión pertenece a otro cajero.';
  end if;

  if p_document_type not in ('01', '03') then
    raise exception 'Tipo de comprobante inválido.';
  end if;

  if p_payment_method not in (
    'cash',
    'yape',
    'plin',
    'card',
    'transfer'
  ) then
    raise exception 'Método de pago inválido.';
  end if;

  if p_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = p_customer_id
      and organization_id = v_session.organization_id
      and active = true;

    if not found then
      raise exception 'Cliente no válido.';
    end if;
  end if;

  if p_document_type = '01'
     and (
       p_customer_id is null
       or v_customer.document_type <> '6'
     ) then
    raise exception 'La factura requiere un cliente con RUC.';
  end if;

  select
    d.sale_id,
    d.correlative,
    d.taxable_amount,
    d.igv_amount,
    d.total_amount
  into
    v_sale_id,
    v_correlative,
    v_taxable,
    v_igv,
    v_total
  from public.create_sale_draft(
    v_session.branch_id,
    p_document_type,
    upper(p_series),
    case
      when p_customer_id is null then null
      else v_customer.document_type
    end,
    case
      when p_customer_id is null then null
      else v_customer.document_number
    end,
    case
      when p_customer_id is null then 'CLIENTE VARIOS'
      else v_customer.name
    end,
    p_items
  ) d;

  update public.sales
  set session_id = v_session.id,
      customer_id = p_customer_id
  where id = v_sale_id;

  if p_payment_method = 'cash' then
    v_received := round(coalesce(p_received_amount, v_total), 2);

    if v_received < v_total then
      raise exception 'El efectivo recibido no cubre el total de la venta.';
    end if;

    v_change := round(v_received - v_total, 2);
  else
    v_received := v_total;
  end if;

  insert into public.sale_payments (
    organization_id,
    sale_id,
    session_id,
    payment_method,
    amount,
    received_amount,
    change_amount,
    created_by
  )
  values (
    v_session.organization_id,
    v_sale_id,
    v_session.id,
    p_payment_method,
    v_total,
    v_received,
    v_change,
    auth.uid()
  );

  return query
  select
    v_sale_id,
    upper(p_series),
    v_correlative,
    v_taxable,
    v_igv,
    v_total,
    v_change;
end;
$$;

revoke all on function public.create_pos_sale(
  uuid,
  text,
  text,
  uuid,
  jsonb,
  text,
  numeric
) from public, anon, authenticated;

grant execute on function public.create_pos_sale(
  uuid,
  text,
  text,
  uuid,
  jsonb,
  text,
  numeric
) to authenticated;

comment on function public.create_pos_sale(
  uuid,
  text,
  text,
  uuid,
  jsonb,
  text,
  numeric
) is
  'Crea una venta POS. Cliente varios conserva nombre explícito y no inventa DNI/RUC.';

insert into public.schema_change_log (
  script_code,
  script_name,
  description
)
values (
  '016',
  'clientes_manuales_y_cliente_generico',
  'Normaliza Cliente varios sin DNI/RUC ficticio, registra origen de verificación y habilita alta manual controlada solo para DNI.'
);

commit;
