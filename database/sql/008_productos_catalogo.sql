-- Endurece el catálogo comercial de productos. Ejecutar una sola vez desde Supabase SQL Editor.
begin;
DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '008') then raise exception 'El script 008 ya fue aplicado.'; end if;
  if not exists (select 1 from public.schema_change_log where script_code = '007') then raise exception 'Debe ejecutar primero 007_configuracion_administrable.sql.'; end if;
end $$;
create or replace function public.normalize_product_catalog_fields() returns trigger language plpgsql set search_path = public as $$
begin new.name := btrim(new.name); new.sku := nullif(btrim(new.sku), ''); new.description := nullif(btrim(new.description), ''); return new; end;
$$;
revoke all on function public.normalize_product_catalog_fields() from public, anon, authenticated;
create trigger products_normalize_catalog_fields before insert or update on public.products for each row execute function public.normalize_product_catalog_fields();
alter table public.products add constraint products_name_not_blank_check check (btrim(name) <> '');
drop index public.products_org_sku_unique_idx;
create unique index products_org_sku_normalized_unique_idx on public.products (organization_id, lower(btrim(sku))) where nullif(btrim(sku), '') is not null;
insert into public.schema_change_log (script_code, script_name, description) values ('008', 'productos_catalogo', 'Normalización y restricciones del catálogo de productos, incluido SKU único por organización.');
commit;
