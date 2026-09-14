-- 004_indices.sql
-- Índices de consulta para el MVP. No duplicar índices creados por PK/UNIQUE.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '004') then
    raise exception 'El script 004 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '003') then
    raise exception 'Debe ejecutar primero 003_seguridad_rls.sql.';
  end if;
end
$$;

create index products_org_active_name_idx
  on public.products (organization_id, active, lower(name));

create unique index products_org_sku_unique_idx
  on public.products (organization_id, lower(sku))
  where sku is not null;

create index sales_org_branch_created_idx
  on public.sales (organization_id, branch_id, created_at desc);

create index sales_org_status_created_idx
  on public.sales (organization_id, status, created_at desc);

create index sales_created_by_idx
  on public.sales (created_by, created_at desc);

create index sale_items_sale_idx
  on public.sale_items (sale_id);

create index expenses_org_branch_date_idx
  on public.expenses (organization_id, branch_id, expense_date desc)
  where is_voided = false;

create index audit_logs_org_created_idx
  on public.audit_logs (organization_id, created_at desc);

create index webhook_events_received_idx
  on public.webhook_events (received_at desc);

create index webhook_events_pending_idx
  on public.webhook_events (received_at)
  where processed_at is null;

insert into public.schema_change_log (script_code, script_name, description)
values ('004', 'indices', 'Índices para catálogo, comprobantes, egresos, auditoría y webhooks.');

commit;
