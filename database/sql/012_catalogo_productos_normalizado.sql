-- 012_catalogo_productos_normalizado.sql
-- Códigos internos estables, categorías de producto y código SUNAT/UNSPSC.
-- Ejecutar manualmente una sola vez después de 011.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '012') then
    raise exception 'El script 012 ya fue aplicado.';
  end if;

  if not exists (select 1 from public.schema_change_log where script_code = '011') then
    raise exception 'Debe ejecutar primero 011_intifact_emision.sql.';
  end if;
end
$$;

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  sort_order integer not null default 100 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index product_categories_org_code_unique_idx
  on public.product_categories (organization_id, lower(btrim(code)));

create unique index product_categories_org_name_unique_idx
  on public.product_categories (organization_id, lower(btrim(name)));

alter table public.product_categories enable row level security;
revoke all on table public.product_categories from anon, authenticated;
grant select, insert, update on public.product_categories to authenticated;

create policy product_categories_select_members
on public.product_categories
for select to authenticated
using (public.is_org_member(organization_id));

create policy product_categories_write_owner
on public.product_categories
for all to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create or replace function public.normalize_product_category_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.code := upper(btrim(new.code));
  new.name := btrim(new.name);

  if new.code !~ '^[A-Z0-9_]{2,24}$' then
    raise exception 'Código de categoría inválido.';
  end if;

  if new.name = '' then
    raise exception 'El nombre de categoría es obligatorio.';
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_product_category_fields() from public, anon, authenticated;

create trigger product_categories_normalize_fields
before insert or update on public.product_categories
for each row execute function public.normalize_product_category_fields();

create trigger product_categories_set_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

create or replace function public.seed_default_product_categories(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.product_categories (
    organization_id,
    code,
    name,
    sort_order,
    active
  )
  values
    (p_organization_id, 'BEBIDAS', 'Bebidas', 10, true),
    (p_organization_id, 'COMIDAS', 'Comidas', 20, true),
    (p_organization_id, 'HAMBURGUESAS', 'Hamburguesas', 30, true),
    (p_organization_id, 'SALCHIPAPAS', 'Salchipapas', 40, true),
    (p_organization_id, 'BROASTER', 'Broaster', 50, true),
    (p_organization_id, 'COMBOS', 'Combos', 60, true),
    (p_organization_id, 'ACOMPANAMIENTOS', 'Acompañamientos', 70, true),
    (p_organization_id, 'OTROS', 'Otros', 999, true)
  on conflict do nothing;
end;
$$;

revoke all on function public.seed_default_product_categories(uuid) from public, anon, authenticated;

select public.seed_default_product_categories(o.id)
from public.organizations o;

create or replace function public.seed_product_categories_for_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.seed_default_product_categories(new.id);
  return new;
end;
$$;

revoke all on function public.seed_product_categories_for_new_organization() from public, anon, authenticated;

create trigger organizations_seed_product_categories
after insert on public.organizations
for each row execute function public.seed_product_categories_for_new_organization();

create table public.product_code_counters (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  current_value bigint not null default 0 check (current_value >= 0),
  updated_at timestamptz not null default now()
);

alter table public.product_code_counters enable row level security;
revoke all on table public.product_code_counters from public, anon, authenticated;

alter table public.products
  add column product_code text,
  add column category_id uuid,
  add column sunat_product_code text;

with ranked as (
  select
    p.id,
    row_number() over (
      partition by p.organization_id
      order by p.created_at, p.id
    ) as seq
  from public.products p
)
update public.products p
set product_code = 'P' || lpad(r.seq::text, 6, '0')
from ranked r
where r.id = p.id;

update public.products p
set category_id = c.id
from public.product_categories c
where c.organization_id = p.organization_id
  and c.code = 'OTROS'
  and p.category_id is null;

update public.products
set sku = upper(btrim(sku))
where nullif(btrim(sku), '') is not null;

DO $$
begin
  if exists (
    select 1
    from public.products
    where product_code is null
       or category_id is null
  ) then
    raise exception 'No se pudo normalizar código/categoría de uno o más productos.';
  end if;
end
$$;

alter table public.products
  alter column product_code set not null,
  alter column category_id set not null,
  add constraint products_product_code_check
    check (product_code ~ '^[A-Z0-9][A-Z0-9_-]{2,19}$'),
  add constraint products_sunat_product_code_check
    check (
      sunat_product_code is null
      or sunat_product_code ~ '^[0-9]{8}$'
    ),
  add constraint products_category_fk
    foreign key (category_id, organization_id)
    references public.product_categories(id, organization_id)
    on delete restrict;

create unique index products_org_product_code_unique_idx
  on public.products (organization_id, lower(product_code));

insert into public.product_code_counters (organization_id, current_value)
select
  o.id,
  coalesce(count(p.id), 0)::bigint
from public.organizations o
left join public.products p on p.organization_id = o.id
group by o.id;

create or replace function public.normalize_product_catalog_fields()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_number bigint;
  v_default_category uuid;
begin
  new.name := btrim(new.name);
  new.sku := nullif(upper(btrim(new.sku)), '');
  new.description := nullif(btrim(new.description), '');
  new.sunat_product_code := nullif(btrim(new.sunat_product_code), '');

  if tg_op = 'UPDATE' and new.product_code is distinct from old.product_code then
    raise exception 'El código interno del producto es inmutable.';
  end if;

  if tg_op = 'INSERT' and nullif(btrim(new.product_code), '') is null then
    insert into public.product_code_counters as pc (
      organization_id,
      current_value,
      updated_at
    )
    values (new.organization_id, 1, now())
    on conflict (organization_id) do update
    set current_value = pc.current_value + 1,
        updated_at = now()
    returning current_value into v_number;

    new.product_code := 'P' || lpad(v_number::text, 6, '0');
  else
    new.product_code := upper(btrim(new.product_code));
  end if;

  if new.category_id is null then
    select c.id
    into v_default_category
    from public.product_categories c
    where c.organization_id = new.organization_id
      and c.code = 'OTROS'
      and c.active = true
    limit 1;

    if v_default_category is null then
      raise exception 'No existe la categoría OTROS para esta organización.';
    end if;

    new.category_id := v_default_category;
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_product_catalog_fields() from public, anon, authenticated;

comment on column public.products.product_code is
  'Código interno estable del producto. Se usa como detalle.codProducto en Intifact; no es el UUID.';
comment on column public.products.sku is
  'SKU comercial opcional. Se normaliza a mayúsculas y puede usarse para búsqueda/operación.';
comment on column public.products.sunat_product_code is
  'Código SUNAT UNSPSC de exactamente 8 dígitos para detalle.codProdSunat en Intifact.';
comment on column public.products.category_id is
  'Categoría operativa del catálogo/POS.';

alter table public.sale_items
  add column product_code text,
  add column sunat_product_code text;

update public.sale_items si
set
  product_code = p.product_code,
  sunat_product_code = p.sunat_product_code
from public.products p
where p.id = si.product_id
  and p.organization_id = si.organization_id
  and si.product_code is null;

DO $$
begin
  if exists (
    select 1
    from public.sale_items
    where product_code is null
  ) then
    raise exception 'No se pudo determinar el código interno de uno o más items históricos.';
  end if;
end
$$;

alter table public.sale_items
  alter column product_code set not null,
  add constraint sale_items_product_code_check
    check (product_code ~ '^[A-Z0-9][A-Z0-9_-]{2,19}$'),
  add constraint sale_items_sunat_product_code_check
    check (
      sunat_product_code is null
      or sunat_product_code ~ '^[0-9]{8}$'
    );

comment on column public.sale_items.product_code is
  'Snapshot del código interno enviado como codProducto a Intifact.';
comment on column public.sale_items.sunat_product_code is
  'Snapshot del código SUNAT UNSPSC enviado como codProdSunat cuando existe.';

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

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener al menos un producto.';
  end if;

  select b.organization_id
  into v_organization_id
  from public.branches b
  where b.id = p_branch_id
    and b.active = true;

  if v_organization_id is null
     or not public.can_access_branch(v_organization_id, p_branch_id) then
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
  )
  values (
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
    product_code,
    sunat_product_code,
    description,
    unit_code,
    tax_affectation_code,
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
    p.product_code,
    p.sunat_product_code,
    p.name,
    p.unit_code,
    p.tax_affectation_code,
    x.quantity,
    p.price,
    round(
      case
        when p.tax_affectation_code = '10'
          then (p.price * x.quantity) / 1.18
        else p.price * x.quantity
      end,
      2
    ),
    round(
      case
        when p.tax_affectation_code = '10'
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

  return query
  select v_sale_id, v_correlative, v_taxable, v_igv, v_total;
end;
$$;

insert into public.schema_change_log (script_code, script_name, description)
values (
  '012',
  'catalogo_productos_normalizado',
  'Código interno estable, SKU normalizado, categorías operativas y código UNSPSC SUNAT con snapshot fiscal por item.'
);

commit;
