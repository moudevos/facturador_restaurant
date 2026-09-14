-- 002_funciones_y_triggers.sql
-- Helpers de autorización, auditoría, timestamps y creación atómica de ventas.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '002') then
    raise exception 'El script 002 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '001') then
    raise exception 'Debe ejecutar primero 001_esquema_inicial.sql.';
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger document_sequences_set_updated_at
before update on public.document_sequences
for each row execute function public.set_updated_at();

create trigger sales_set_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create or replace function public.current_user_role(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = auth.uid()
    and om.active = true
  limit 1;
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.active = true
  );
$$;

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
      and om.active = true
  );
$$;

create or replace function public.can_access_branch(p_organization_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.active = true
      and (om.role = 'owner' or om.branch_id is null or om.branch_id = p_branch_id)
  );
$$;

create or replace function public.create_sale_draft(
  p_branch_id uuid,
  p_document_type text,
  p_series text,
  p_customer_document_type text default null,
  p_customer_document_number text default null,
  p_customer_name text default null,
  p_items jsonb default '[]'::jsonb
)
returns table (
  sale_id uuid,
  correlative bigint,
  taxable_amount numeric,
  igv_amount numeric,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_organization_id uuid;
  v_sale_id uuid := gen_random_uuid();
  v_correlative bigint;
  v_expected_items integer;
  v_inserted_items integer;
  v_taxable numeric(12,2);
  v_igv numeric(12,2);
  v_total numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener al menos un producto.';
  end if;

  select b.organization_id
  into v_organization_id
  from public.branches b
  where b.id = p_branch_id
    and b.active = true;

  if v_organization_id is null or not public.can_access_branch(v_organization_id, p_branch_id) then
    raise exception 'No tiene acceso al local indicado.';
  end if;

  update public.document_sequences ds
  set current_value = current_value + 1
  where ds.branch_id = p_branch_id
    and ds.organization_id = v_organization_id
    and ds.document_type = p_document_type
    and ds.series = upper(p_series)
    and ds.active = true
  returning current_value into v_correlative;

  if v_correlative is null then
    raise exception 'No existe una serie activa para el tipo de documento solicitado.';
  end if;

  insert into public.sales (
    id,
    organization_id,
    branch_id,
    document_type,
    series,
    correlative,
    customer_document_type,
    customer_document_number,
    customer_name,
    created_by
  ) values (
    v_sale_id,
    v_organization_id,
    p_branch_id,
    p_document_type,
    upper(p_series),
    v_correlative,
    nullif(trim(p_customer_document_type), ''),
    nullif(trim(p_customer_document_number), ''),
    nullif(trim(p_customer_name), ''),
    auth.uid()
  );

  v_expected_items := jsonb_array_length(p_items);

  insert into public.sale_items (
    sale_id,
    organization_id,
    product_id,
    description,
    unit_code,
    quantity,
    unit_price,
    line_subtotal,
    line_igv,
    line_total
  )
  select
    v_sale_id,
    v_organization_id,
    p.id,
    p.name,
    p.unit_code,
    x.quantity,
    p.price,
    round(
      case when p.tax_affectation_code = '10'
        then (p.price * x.quantity) / 1.18
        else p.price * x.quantity
      end,
      2
    ),
    round(
      case when p.tax_affectation_code = '10'
        then (p.price * x.quantity) - ((p.price * x.quantity) / 1.18)
        else 0
      end,
      2
    ),
    round(p.price * x.quantity, 2)
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
  join public.products p
    on p.id = x.product_id
   and p.organization_id = v_organization_id
   and p.active = true
  where x.quantity > 0;

  get diagnostics v_inserted_items = row_count;

  if v_inserted_items <> v_expected_items then
    raise exception 'Uno o más productos no existen, están inactivos o tienen cantidad inválida.';
  end if;

  select
    coalesce(sum(si.line_subtotal), 0),
    coalesce(sum(si.line_igv), 0),
    coalesce(sum(si.line_total), 0)
  into v_taxable, v_igv, v_total
  from public.sale_items si
  where si.sale_id = v_sale_id;

  update public.sales
  set taxable_amount = v_taxable,
      igv_amount = v_igv,
      total_amount = v_total
  where id = v_sale_id;

  return query select v_sale_id, v_correlative, v_taxable, v_igv, v_total;
end;
$$;

create or replace function public.prevent_financial_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Los registros financieros no se eliminan físicamente. Use el flujo de anulación correspondiente.';
end;
$$;

create trigger sales_prevent_delete
before delete on public.sales
for each row execute function public.prevent_financial_delete();

create trigger expenses_prevent_delete
before delete on public.expenses
for each row execute function public.prevent_financial_delete();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_organization_id uuid;
  v_entity_id text;
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new);
  end if;

  if tg_table_name = 'organizations' then
    v_organization_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  else
    v_organization_id := coalesce((v_new ->> 'organization_id')::uuid, (v_old ->> 'organization_id')::uuid);
  end if;

  v_entity_id := coalesce(v_new ->> 'id', v_old ->> 'id');

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) values (
    v_organization_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;

create trigger organizations_audit
after insert or update or delete on public.organizations
for each row execute function public.audit_row_change();

create trigger branches_audit
after insert or update or delete on public.branches
for each row execute function public.audit_row_change();

create trigger organization_members_audit
after insert or update or delete on public.organization_members
for each row execute function public.audit_row_change();

create trigger products_audit
after insert or update or delete on public.products
for each row execute function public.audit_row_change();

create trigger sales_audit
after insert or update or delete on public.sales
for each row execute function public.audit_row_change();

create trigger expenses_audit
after insert or update or delete on public.expenses
for each row execute function public.audit_row_change();

insert into public.schema_change_log (script_code, script_name, description)
values ('002', 'funciones_y_triggers', 'Funciones de autorización, timestamps, creación atómica de ventas, protección de borrado y auditoría.');

commit;
