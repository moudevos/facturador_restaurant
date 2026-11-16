-- 017_finanzas_restaurante.sql
-- Ejecutar manualmente en Supabase SQL Editor DESPUES del 016.
-- No reescribe las migraciones anteriores ni elimina comprobantes existentes.
begin;

do $$
begin
  if exists (select 1 from public.schema_change_log where script_code='017') then
    raise exception '017 ya fue aplicado';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code='016') then
    raise exception 'Aplicar primero 016_clientes_manuales_y_cliente_generico.sql';
  end if;
end $$;

-- Medios de pago administrables. La marca cash es la única que representa efectivo físico.
create table public.restaurant_payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]{2,32}$'),
  name text not null check (btrim(name) <> ''),
  kind text not null check (kind in ('cash','wallet','card','bank','other')),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);

insert into public.restaurant_payment_methods (organization_id,code,name,kind,sort_order)
select o.id, d.code, d.name, d.kind, d.sort_order
from public.organizations o
cross join (values
 ('cash','Efectivo','cash',10),
 ('yape','Yape','wallet',20),
 ('plin','Plin','wallet',30),
 ('card','Tarjeta','card',40),
 ('transfer','Transferencia','bank',50)
) as d(code,name,kind,sort_order);

create table public.restaurant_discount_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  scope text not null check (scope in ('line','sale','both')),
  mode text not null check (mode in ('percent','fixed')),
  value numeric(12,2) not null check (value >= 0),
  max_amount numeric(12,2) check (max_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (mode <> 'percent' or value <= 100),
  unique (id,organization_id)
);

-- El catálogo existente permanece; combos y adicionales solo configuran opciones.
create table public.restaurant_combo_components (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  combo_product_id uuid not null,
  component_product_id uuid not null,
  quantity numeric(12,3) not null check (quantity > 0),
  price_mode text not null default 'fixed' check (price_mode in ('fixed','sum')),
  foreign key (combo_product_id,organization_id) references public.products(id,organization_id) on delete restrict,
  foreign key (component_product_id,organization_id) references public.products(id,organization_id) on delete restrict,
  check (combo_product_id <> component_product_id)
);

create table public.restaurant_product_addons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid not null,
  name text not null check (btrim(name) <> ''),
  extra_price numeric(12,2) not null default 0 check (extra_price >= 0),
  active boolean not null default true,
  foreign key (product_id,organization_id) references public.products(id,organization_id) on delete restrict,
  unique (id,organization_id)
);

-- Ingresos manuales separados de las ventas POS.
create table public.restaurant_other_income (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  income_date date not null,
  description text not null check (btrim(description) <> ''),
  amount numeric(12,2) not null check (amount > 0),
  payment_method_id uuid,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (branch_id,organization_id) references public.branches(id,organization_id),
  foreign key (payment_method_id,organization_id) references public.restaurant_payment_methods(id,organization_id)
);

-- Los egresos se devengan en expense_date; pagar una deuda NO genera otro egreso.
alter table public.expenses
  add column payment_terms text not null default 'paid' check (payment_terms in ('paid','credit')),
  add column payment_method_id uuid references public.restaurant_payment_methods(id);

create table public.restaurant_expense_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  expense_id uuid not null references public.expenses(id) on delete restrict,
  paid_at timestamptz not null default now(),
  amount numeric(12,2) not null check (amount > 0),
  payment_method_id uuid,
  payment_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (payment_method_id,organization_id) references public.restaurant_payment_methods(id,organization_id)
);
create index restaurant_expense_payments_expense_idx on public.restaurant_expense_payments (expense_id);

create table public.restaurant_expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  unique (organization_id,code)
);
insert into public.restaurant_expense_categories (organization_id,code,name)
select o.id,d.code,d.name from public.organizations o
cross join (values
 ('compras','Compras'),('servicios','Servicios'),('personal','Personal'),
 ('transporte','Transporte'),('mantenimiento','Mantenimiento'),('otros','Otros')
) as d(code,name);
-- Las nuevas categorías dinámicas se guardarán en expenses.category.
alter table public.expenses drop constraint if exists expenses_category_check;

-- Cada corrección queda registrada en la fecha en que se realiza; no se reabre el cierre anterior.
create table public.restaurant_legacy_sale_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id uuid not null,
  adjusted_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (length(btrim(reason)) >= 3),
  fiscal_note_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (sale_id,organization_id) references public.sales(id,organization_id) on delete restrict
);

-- RLS: solo propietarios escriben configuraciones; todo acceso requiere pertenencia.
do $$
declare t text;
begin
  foreach t in array array[
    'restaurant_payment_methods','restaurant_discount_rules',
    'restaurant_combo_components','restaurant_product_addons',
    'restaurant_other_income','restaurant_expense_payments',
    'restaurant_expense_categories','restaurant_legacy_sale_adjustments'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',t||'_read',t);
  end loop;
end $$;

grant insert,update on public.restaurant_payment_methods,public.restaurant_discount_rules,
  public.restaurant_combo_components,public.restaurant_product_addons,
  public.restaurant_expense_categories to authenticated;
grant insert on public.restaurant_other_income to authenticated;

create policy restaurant_payment_methods_owner on public.restaurant_payment_methods
  for all to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy restaurant_discount_rules_owner on public.restaurant_discount_rules
  for all to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy restaurant_combo_components_owner on public.restaurant_combo_components
  for all to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy restaurant_product_addons_owner on public.restaurant_product_addons
  for all to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy restaurant_expense_categories_owner on public.restaurant_expense_categories
  for all to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
create policy restaurant_other_income_owner on public.restaurant_other_income
  for insert to authenticated with check (
    public.is_org_owner(organization_id)
    and public.can_access_branch(organization_id,branch_id)
    and created_by = (select auth.uid())
  );

-- Registrar abono de deuda de forma atómica, sin modificar ni duplicar el egreso.
create or replace function public.restaurant_pay_expense(
  p_expense_id uuid,
  p_amount numeric,
  p_method_id uuid default null,
  p_reference text default null
) returns uuid language plpgsql security definer
set search_path=public,auth set row_security=off as $$
declare e public.expenses%rowtype; v_paid numeric; v_id uuid;
begin
  select * into e from public.expenses where id=p_expense_id for update;
  if not found or not public.is_org_owner(e.organization_id)
     or not public.can_access_branch(e.organization_id,e.branch_id) then
    raise exception 'Egreso inexistente o acceso denegado';
  end if;
  if e.is_voided or e.payment_terms <> 'credit' then
    raise exception 'Solo se admiten abonos a egresos a crédito vigentes';
  end if;
  if p_amount is null or round(p_amount,2) <= 0 or p_amount <> round(p_amount,2) then
    raise exception 'Importe inválido';
  end if;
  if p_method_id is not null and not exists (
    select 1 from public.restaurant_payment_methods m
    where m.id=p_method_id and m.organization_id=e.organization_id and m.active
  ) then raise exception 'Método de pago inválido'; end if;
  select coalesce(sum(amount),0) into v_paid
  from public.restaurant_expense_payments where expense_id=e.id;
  if v_paid + p_amount > e.amount then raise exception 'El abono supera el saldo pendiente'; end if;
  insert into public.restaurant_expense_payments
    (organization_id,expense_id,amount,payment_method_id,payment_reference,created_by)
  values (e.organization_id,e.id,p_amount,p_method_id,nullif(btrim(p_reference),''),auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.restaurant_pay_expense(uuid,numeric,uuid,text) from public,anon,authenticated;
grant execute on function public.restaurant_pay_expense(uuid,numeric,uuid,text) to authenticated;

-- Resumen simple por movimientos. No confunde abonos de deuda con nuevos egresos.
-- No es un estado financiero tributario; los importes son brutos operativos.
create view public.v_restaurant_result_movements
with (security_invoker=true) as
  select s.organization_id,s.branch_id,
    s.fiscal_issue_date as business_date,
    'sale'::text as movement_type,
    s.id as source_id,
    s.total_amount::numeric(14,2) as signed_amount
  from public.sales s
  where s.commercial_status='completed'
    and s.status='accepted'
  union all
  select i.organization_id,i.branch_id,i.income_date,'other_income',i.id,i.amount
  from public.restaurant_other_income i
  union all
  select e.organization_id,e.branch_id,e.expense_date,'expense',e.id,(-e.amount)::numeric(14,2)
  from public.expenses e
  union all
  select e.organization_id,e.branch_id,
    (timezone(o.timezone,e.voided_at))::date,'expense_reversal',e.id,
    e.amount::numeric(14,2)
  from public.expenses e
  join public.organizations o on o.id=e.organization_id
  where e.is_voided and e.voided_at is not null
  union all
  select a.organization_id,s.branch_id,a.adjusted_on,'sale_reversal',a.id,
    (-a.amount)::numeric(14,2)
  from public.restaurant_legacy_sale_adjustments a
  join public.sales s on s.id=a.sale_id and s.organization_id=a.organization_id;

grant select on public.v_restaurant_result_movements to authenticated;


-- Agregado diario: evita límites de paginación en meses con muchas ventas.
create view public.v_restaurant_daily_result
with (security_invoker=true) as
select organization_id, branch_id, business_date,
  coalesce(sum(signed_amount) filter (where movement_type in ('sale','other_income','sale_reversal')),0)::numeric(14,2) as income_amount,
  coalesce(-sum(signed_amount) filter (where movement_type in ('expense','expense_reversal')),0)::numeric(14,2) as expense_amount,
  coalesce(sum(signed_amount),0)::numeric(14,2) as result_amount
from public.v_restaurant_result_movements
group by organization_id,branch_id,business_date;
grant select on public.v_restaurant_daily_result to authenticated;

insert into public.schema_change_log (script_code,script_name,description)
values ('017','finanzas_restaurante','P&L simple, otros ingresos, medios de pago configurables, descuentos, combos, categorías y abonos de deudas.');

commit;
