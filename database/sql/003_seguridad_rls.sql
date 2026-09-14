-- 003_seguridad_rls.sql
-- Habilita RLS y aplica privilegio mínimo para usuarios autenticados.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '003') then
    raise exception 'El script 003 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '002') then
    raise exception 'Debe ejecutar primero 002_funciones_y_triggers.sql.';
  end if;
end
$$;

alter table public.schema_change_log enable row level security;
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.organization_members enable row level security;
alter table public.products enable row level security;
alter table public.document_sequences enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.schema_change_log from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.branches from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.document_sequences from anon, authenticated;
revoke all on table public.sales from anon, authenticated;
revoke all on table public.sale_items from anon, authenticated;
revoke all on table public.expenses from anon, authenticated;
revoke all on table public.webhook_events from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_financial_delete() from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.current_user_role(uuid) from public, anon, authenticated;
revoke all on function public.is_org_member(uuid) from public, anon, authenticated;
revoke all on function public.is_org_owner(uuid) from public, anon, authenticated;
revoke all on function public.can_access_branch(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_sale_draft(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.organizations to authenticated;
grant select on public.branches to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, update on public.products to authenticated;
grant select on public.document_sequences to authenticated;
grant select on public.sales to authenticated;
grant select on public.sale_items to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select on public.audit_logs to authenticated;

grant execute on function public.current_user_role(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.can_access_branch(uuid, uuid) to authenticated;
grant execute on function public.create_sale_draft(uuid, text, text, text, text, text, jsonb) to authenticated;

create policy organizations_select_members
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (public.is_org_owner(id))
with check (public.is_org_owner(id));

create policy branches_select_members
on public.branches
for select
to authenticated
using (public.is_org_member(organization_id));

create policy branches_write_owner
on public.branches
for all
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy organization_members_select_self_or_owner
on public.organization_members
for select
to authenticated
using (user_id = auth.uid() or public.is_org_owner(organization_id));

create policy organization_members_write_owner
on public.organization_members
for all
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy products_select_members
on public.products
for select
to authenticated
using (public.is_org_member(organization_id));

create policy products_insert_owner
on public.products
for insert
to authenticated
with check (public.is_org_owner(organization_id) and created_by = auth.uid());

create policy products_update_owner
on public.products
for update
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy document_sequences_select_owner
on public.document_sequences
for select
to authenticated
using (public.is_org_owner(organization_id));

create policy sales_select_branch_members
on public.sales
for select
to authenticated
using (public.can_access_branch(organization_id, branch_id));

create policy sale_items_select_branch_members
on public.sale_items
for select
to authenticated
using (
  exists (
    select 1
    from public.sales s
    where s.id = sale_items.sale_id
      and public.can_access_branch(s.organization_id, s.branch_id)
  )
);

create policy expenses_select_branch_members
on public.expenses
for select
to authenticated
using (public.can_access_branch(organization_id, branch_id));

create policy expenses_insert_owner
on public.expenses
for insert
to authenticated
with check (
  public.is_org_owner(organization_id)
  and created_by = auth.uid()
  and public.can_access_branch(organization_id, branch_id)
);

create policy expenses_update_owner
on public.expenses
for update
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create policy audit_logs_select_owner
on public.audit_logs
for select
to authenticated
using (organization_id is not null and public.is_org_owner(organization_id));

insert into public.schema_change_log (script_code, script_name, description)
values ('003', 'seguridad_rls', 'RLS, grants de mínimo privilegio y políticas owner/cashier.');

commit;
