-- 013_comprobantes_fiscales.sql
-- Fecha fiscal inmutable y resumen filtrado para el módulo de comprobantes.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '013') then
    raise exception 'El script 013 ya fue aplicado.';
  end if;

  if not exists (select 1 from public.schema_change_log where script_code = '012') then
    raise exception 'Debe ejecutar primero 012_catalogo_productos_normalizado.sql.';
  end if;
end
$$;

alter table public.sales
  add column fiscal_issue_date date;

update public.sales s
set fiscal_issue_date =
  (timezone(o.timezone, coalesce(s.issued_at, s.created_at)))::date
from public.organizations o
where o.id = s.organization_id
  and s.fiscal_issue_date is null;

alter table public.sales
  alter column fiscal_issue_date set not null;

comment on column public.sales.fiscal_issue_date is
  'Fecha fiscal del comprobante en la zona horaria de la organización. Se congela al crear la venta y no cambia en retries.';

create or replace function public.set_sale_fiscal_issue_date()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_timezone text;
begin
  if new.fiscal_issue_date is null then
    select o.timezone
    into v_timezone
    from public.organizations o
    where o.id = new.organization_id;

    if v_timezone is null then
      raise exception 'No se pudo determinar la zona horaria de la organización.';
    end if;

    new.fiscal_issue_date := (timezone(v_timezone, now()))::date;
  end if;

  return new;
end;
$$;

revoke all on function public.set_sale_fiscal_issue_date() from public, anon, authenticated;

create trigger sales_set_fiscal_issue_date
before insert on public.sales
for each row execute function public.set_sale_fiscal_issue_date();

create or replace function public.guard_sale_fiscal_issue_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.fiscal_issue_date is distinct from old.fiscal_issue_date then
    raise exception 'La fecha fiscal del comprobante es inmutable.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_sale_fiscal_issue_date() from public, anon, authenticated;

create trigger sales_guard_fiscal_issue_date
before update of fiscal_issue_date on public.sales
for each row execute function public.guard_sale_fiscal_issue_date();

create index sales_documents_filter_idx
  on public.sales (
    organization_id,
    fiscal_issue_date desc,
    status,
    document_type,
    branch_id
  );

create or replace function public.document_filtered_summary(
  p_organization_id uuid,
  p_branch_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_document_type text default null,
  p_status text default 'all',
  p_query text default null
)
returns table (
  record_count bigint,
  accepted_count bigint,
  pending_count bigint,
  issue_count bigint,
  accepted_amount numeric
)
language plpgsql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_query text := nullif(btrim(p_query), '');
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'No pertenece a la organización.';
  end if;

  if p_branch_id is not null
     and not public.can_access_branch(p_organization_id, p_branch_id) then
    raise exception 'No tiene acceso al local indicado.';
  end if;

  if p_document_type is not null and p_document_type not in ('01', '03') then
    raise exception 'Tipo de comprobante inválido.';
  end if;

  if p_status not in (
    'all',
    'accepted',
    'pending',
    'rejected',
    'queue_failed',
    'error',
    'voided'
  ) then
    raise exception 'Estado de comprobante inválido.';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where s.status = 'accepted')::bigint,
    count(*) filter (
      where s.status in ('draft', 'queued', 'processing')
    )::bigint,
    count(*) filter (
      where s.status in ('rejected', 'queue_failed', 'error')
    )::bigint,
    coalesce(
      sum(s.total_amount) filter (where s.status = 'accepted'),
      0
    )::numeric
  from public.sales s
  where s.organization_id = p_organization_id
    and public.can_access_branch(s.organization_id, s.branch_id)
    and (p_branch_id is null or s.branch_id = p_branch_id)
    and (p_date_from is null or s.fiscal_issue_date >= p_date_from)
    and (p_date_to is null or s.fiscal_issue_date <= p_date_to)
    and (p_document_type is null or s.document_type = p_document_type)
    and (
      p_status = 'all'
      or (p_status = 'pending' and s.status in ('draft', 'queued', 'processing'))
      or (p_status <> 'pending' and s.status = p_status)
    )
    and (
      v_query is null
      or s.series ilike '%' || v_query || '%'
      or coalesce(s.customer_name, '') ilike '%' || v_query || '%'
      or coalesce(s.customer_document_number, '') ilike '%' || v_query || '%'
      or (
        v_query ~ '^[0-9]+$'
        and s.correlative = v_query::bigint
      )
    );
end;
$$;

revoke all on function public.document_filtered_summary(
  uuid, uuid, date, date, text, text, text
) from public, anon;

grant execute on function public.document_filtered_summary(
  uuid, uuid, date, date, text, text, text
) to authenticated;

insert into public.schema_change_log (script_code, script_name, description)
values (
  '013',
  'comprobantes_fiscales',
  'Fecha fiscal inmutable por venta, índice de consulta y resumen filtrado para el módulo de comprobantes.'
);

commit;
