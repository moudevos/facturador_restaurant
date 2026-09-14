-- 005_vistas_reportes_iniciales.sql
-- Vistas iniciales para dashboard. SECURITY INVOKER mantiene las RLS subyacentes.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '005') then
    raise exception 'El script 005 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '004') then
    raise exception 'Debe ejecutar primero 004_indices.sql.';
  end if;
end
$$;

create view public.v_daily_sales
with (security_invoker = true)
as
select
  s.organization_id,
  s.branch_id,
  (timezone(o.timezone, coalesce(s.issued_at, s.created_at)))::date as business_date,
  count(*) as document_count,
  sum(s.total_amount)::numeric(14,2) as invoiced_amount
from public.sales s
join public.organizations o on o.id = s.organization_id
where s.status = 'accepted'
group by s.organization_id, s.branch_id, (timezone(o.timezone, coalesce(s.issued_at, s.created_at)))::date;

create view public.v_daily_expenses
with (security_invoker = true)
as
select
  e.organization_id,
  e.branch_id,
  e.expense_date as business_date,
  count(*) as expense_count,
  sum(e.amount)::numeric(14,2) as expense_amount
from public.expenses e
where e.is_voided = false
group by e.organization_id, e.branch_id, e.expense_date;

create view public.v_daily_financial_summary
with (security_invoker = true)
as
select
  coalesce(s.organization_id, e.organization_id) as organization_id,
  coalesce(s.branch_id, e.branch_id) as branch_id,
  coalesce(s.business_date, e.business_date) as business_date,
  coalesce(s.document_count, 0) as document_count,
  coalesce(s.invoiced_amount, 0)::numeric(14,2) as invoiced_amount,
  coalesce(e.expense_count, 0) as expense_count,
  coalesce(e.expense_amount, 0)::numeric(14,2) as expense_amount,
  (coalesce(s.invoiced_amount, 0) - coalesce(e.expense_amount, 0))::numeric(14,2) as simple_result
from public.v_daily_sales s
full outer join public.v_daily_expenses e
  on e.organization_id = s.organization_id
 and e.branch_id = s.branch_id
 and e.business_date = s.business_date;

grant select on public.v_daily_sales to authenticated;
grant select on public.v_daily_expenses to authenticated;
grant select on public.v_daily_financial_summary to authenticated;

insert into public.schema_change_log (script_code, script_name, description)
values ('005', 'vistas_reportes_iniciales', 'Vistas diarias de facturación, egresos y resultado simple.');

commit;
