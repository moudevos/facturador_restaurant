-- 016_clientes_manuales_y_cliente_generico.sql
-- Cliente varios se conserva como snapshot explícito sin inventar DNI/RUC.
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
  'Crea una venta POS. Para boleta genérica conserva CLIENTE VARIOS como nombre de snapshot y deja tipo/número de documento vacíos; nunca inventa un DNI.';

insert into public.schema_change_log (
  script_code,
  script_name,
  description
)
values (
  '016',
  'clientes_manuales_y_cliente_generico',
  'Normaliza Cliente varios como snapshot explícito sin DNI/RUC ficticio y mantiene compatibilidad con alta manual de clientes DNI.'
);

commit;
