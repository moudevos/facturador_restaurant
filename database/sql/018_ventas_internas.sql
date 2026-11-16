-- 018_ventas_internas.sql
-- POS interno independiente de Intifact. Aplicar después de 017.
begin;

do $$
begin
 if exists(select 1 from public.schema_change_log where script_code='018') then
   raise exception '018 ya aplicado';
 end if;
 if not exists(select 1 from public.schema_change_log where script_code='017') then
   raise exception 'Ejecutar primero 017_finanzas_restaurante.sql';
 end if;
end $$;

create table public.restaurant_orders (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 branch_id uuid not null,
 session_id uuid not null references public.sales_sessions(id) on delete restrict,
 client_token uuid not null,
 business_date date not null,
 gross_amount numeric(12,2) not null check(gross_amount >= 0),
 discount_amount numeric(12,2) not null default 0 check(discount_amount >= 0),
 total_amount numeric(12,2) not null check(total_amount > 0),
 fiscal_sale_id uuid unique references public.sales(id) on delete restrict,
 customer_id uuid references public.customers(id) on delete restrict,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(organization_id, client_token),
 unique(id, organization_id),
 foreign key(branch_id,organization_id) references public.branches(id,organization_id)
);
create index restaurant_orders_date_idx on public.restaurant_orders(organization_id,business_date desc,branch_id);
create index restaurant_orders_session_idx on public.restaurant_orders(session_id,created_at desc);

create table public.restaurant_order_items (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 order_id uuid not null,
 product_id uuid not null references public.products(id) on delete restrict,
 description text not null,
 quantity numeric(12,3) not null check(quantity>0),
 unit_price numeric(12,2) not null check(unit_price>=0),
 addons jsonb not null default '[]'::jsonb,
 notes text,
 discount_amount numeric(12,2) not null default 0 check(discount_amount>=0),
 line_total numeric(12,2) not null check(line_total>=0),
 foreign key(order_id,organization_id) references public.restaurant_orders(id,organization_id) on delete restrict
);

create table public.restaurant_order_payments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 order_id uuid not null,
 method_id uuid not null,
 amount numeric(12,2) not null check(amount>0),
 verification_code text,
 cash_movement_id uuid unique references public.cash_movements(id) on delete restrict,
 created_at timestamptz not null default now(),
 foreign key(order_id,organization_id) references public.restaurant_orders(id,organization_id) on delete restrict,
 foreign key(method_id,organization_id) references public.restaurant_payment_methods(id,organization_id)
);

-- El ajuste del día de anulación NO borra la venta del cierre original.
create table public.restaurant_order_reversals (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 order_id uuid not null unique,
 business_date date not null,
 reason text not null check(length(btrim(reason))>=3),
 amount numeric(12,2) not null check(amount>0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 foreign key(order_id,organization_id) references public.restaurant_orders(id,organization_id) on delete restrict,
 unique(id,organization_id)
);

-- La devolución de efectivo puede ocurrir después de la reversión.
create table public.restaurant_order_refunds (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 reversal_id uuid not null,
 payment_method_id uuid not null,
 amount numeric(12,2) not null check(amount>0),
 session_id uuid references public.sales_sessions(id) on delete restrict,
 cash_movement_id uuid unique references public.cash_movements(id) on delete restrict,
 reference_code text,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 foreign key(reversal_id,organization_id) references public.restaurant_order_reversals(id,organization_id) on delete restrict,
 foreign key(payment_method_id,organization_id) references public.restaurant_payment_methods(id,organization_id)
);
create index restaurant_order_refunds_reversal_idx on public.restaurant_order_refunds(reversal_id);

create table public.restaurant_preferences (
 organization_id uuid primary key references public.organizations(id) on delete restrict,
 receipt_width_mm integer not null default 80 check(receipt_width_mm in(58,80)),
 updated_at timestamptz not null default now()
);
insert into public.restaurant_preferences(organization_id)
select id from public.organizations;

-- Las filas operativas solo se escriben por funciones transaccionales.
do $$
declare t text;
begin
 foreach t in array array[
   'restaurant_orders','restaurant_order_items',
   'restaurant_order_payments','restaurant_order_reversals',
   'restaurant_order_refunds','restaurant_preferences'
 ] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from anon,authenticated',t);
   execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

create policy restaurant_orders_read on public.restaurant_orders
 for select to authenticated using(public.can_access_branch(organization_id,branch_id));
create policy restaurant_order_items_read on public.restaurant_order_items
 for select to authenticated using(exists(
   select 1 from public.restaurant_orders s where s.id=order_id
   and s.organization_id=organization_id and public.can_access_branch(s.organization_id,s.branch_id)));
create policy restaurant_order_payments_read on public.restaurant_order_payments
 for select to authenticated using(exists(
   select 1 from public.restaurant_orders s where s.id=order_id
   and s.organization_id=organization_id and public.can_access_branch(s.organization_id,s.branch_id)));
create policy restaurant_order_reversals_read on public.restaurant_order_reversals
 for select to authenticated using(exists(
   select 1 from public.restaurant_orders s where s.id=order_id
   and s.organization_id=organization_id and public.can_access_branch(s.organization_id,s.branch_id)));
create policy restaurant_order_refunds_read on public.restaurant_order_refunds
 for select to authenticated using(exists(
   select 1 from public.restaurant_order_reversals r
   join public.restaurant_orders s on s.id=r.order_id
   where r.id=reversal_id and r.organization_id=organization_id
   and public.can_access_branch(s.organization_id,s.branch_id)));
create policy restaurant_preferences_read on public.restaurant_preferences
 for select to authenticated using(public.is_org_member(organization_id));
grant update on public.restaurant_preferences to authenticated;
create policy restaurant_preferences_owner on public.restaurant_preferences
 for update to authenticated using(public.is_org_owner(organization_id))
 with check(public.is_org_owner(organization_id));

-- El servidor, no el navegador, determina precios y valida el total.
create or replace function public.restaurant_checkout(
 p_session_id uuid,
 p_client_token uuid,
 p_items jsonb,
 p_payments jsonb,
 p_sale_discount_rule uuid default null,
 p_customer_id uuid default null
) returns uuid language plpgsql security definer
set search_path=public,auth set row_security=off as $$
declare
 v_session public.sales_sessions%rowtype;
 v_org public.organizations%rowtype;
 v_order_id uuid;
 v_item jsonb;
 v_addon jsonb;
 v_payment jsonb;
 v_product public.products%rowtype;
 v_method public.restaurant_payment_methods%rowtype;
 v_rule public.restaurant_discount_rules%rowtype;
 v_quantity numeric(12,3);
 v_base_price numeric(12,2);
 v_addon_unit numeric(12,2);
 v_line_gross numeric(12,2);
 v_line_discount numeric(12,2);
 v_line_net numeric(12,2);
 v_gross numeric(12,2):=0;
 v_line_discount_total numeric(12,2):=0;
 v_order_discount numeric(12,2):=0;
 v_total numeric(12,2);
 v_payment_sum numeric(12,2):=0;
 v_item_count integer:=0;
 v_payment_count integer:=0;
 v_addons_snapshot jsonb;
 v_addon_row public.restaurant_product_addons%rowtype;
 v_cash_movement_id uuid;
 v_paid numeric(12,2);
 v_id uuid;
begin
 if auth.uid() is null or p_client_token is null then
   raise exception 'Sesión o token de venta inválido';
 end if;
 select * into v_session from public.sales_sessions
 where id=p_session_id and status='open' for update;
 if not found or not public.can_access_branch(v_session.organization_id,v_session.branch_id)
    or (auth.uid()<>v_session.cashier_user_id and not public.is_org_owner(v_session.organization_id)) then
   raise exception 'Abra una sesión de caja válida';
 end if;
 select * into v_org from public.organizations where id=v_session.organization_id;
 select id into v_order_id from public.restaurant_orders
 where organization_id=v_session.organization_id and client_token=p_client_token;
 if v_order_id is not null then return v_order_id; end if;

 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 80
    or jsonb_typeof(p_payments)<>'array' or jsonb_array_length(p_payments) not between 1 and 12 then
   raise exception 'Carrito o pagos inválidos';
 end if;
 if p_customer_id is not null and not exists (
    select 1 from public.customers where id=p_customer_id
    and organization_id=v_session.organization_id and active) then
    raise exception 'Cliente inválido';
 end if;

 -- Primera pasada para validar importes y obtener el bruto desde productos activos.
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_item_count:=v_item_count+1;
   select * into v_product from public.products
   where id=(v_item->>'product_id')::uuid
     and organization_id=v_session.organization_id and active=true;
   if not found then raise exception 'Producto inactivo o desconocido'; end if;
   v_quantity:=(v_item->>'quantity')::numeric;
   if v_quantity is null or v_quantity<=0 or v_quantity>100 or
      v_quantity<>round(v_quantity,3) then raise exception 'Cantidad inválida'; end if;
   v_base_price:=v_product.price;
   if exists (
     select 1 from public.restaurant_combo_components c
     where c.combo_product_id=v_product.id and c.organization_id=v_session.organization_id
       and c.price_mode='sum'
   ) then
     select round(sum(c.quantity * p.price),2) into v_base_price
     from public.restaurant_combo_components c
     join public.products p on p.id=c.component_product_id
     where c.combo_product_id=v_product.id and c.organization_id=v_session.organization_id;
   end if;

   v_addon_unit:=0;
   if v_item ? 'addons' and jsonb_typeof(v_item->'addons')<>'array' then
      raise exception 'Adicionales inválidos'; end if;
   for v_addon in select value from jsonb_array_elements(coalesce(v_item->'addons','[]'::jsonb)) loop
     select * into v_addon_row from public.restaurant_product_addons
     where id=(v_addon->>'addon_id')::uuid
       and product_id=v_product.id
       and organization_id=v_session.organization_id and active;
     if not found then raise exception 'Adicional inválido'; end if;
     v_addon_unit:=v_addon_unit+v_addon_row.extra_price;
   end loop;
   v_line_gross:=round(v_quantity*(v_base_price+v_addon_unit),2);
   if v_line_gross<0 then raise exception 'Importe inválido'; end if;
   v_line_discount:=0;
   if nullif(v_item->>'discount_rule_id','') is not null then
     select * into v_rule from public.restaurant_discount_rules
     where id=(v_item->>'discount_rule_id')::uuid
       and organization_id=v_session.organization_id and active
       and scope in ('line','both');
     if not found then raise exception 'Descuento de producto inválido'; end if;
     v_line_discount:=case when v_rule.mode='percent'
       then round(v_line_gross*v_rule.value/100,2)
       else v_rule.value end;
     v_line_discount:=least(v_line_gross,v_line_discount,coalesce(v_rule.max_amount,v_line_gross));
   end if;
   v_gross:=v_gross+v_line_gross;
   v_line_discount_total:=v_line_discount_total+v_line_discount;
 end loop;

 if p_sale_discount_rule is not null then
   select * into v_rule from public.restaurant_discount_rules
   where id=p_sale_discount_rule and organization_id=v_session.organization_id
     and active and scope in ('sale','both');
   if not found then raise exception 'Descuento de venta inválido'; end if;
   v_order_discount:=case when v_rule.mode='percent'
     then round((v_gross-v_line_discount_total)*v_rule.value/100,2)
     else v_rule.value end;
   v_order_discount:=least(v_gross-v_line_discount_total,v_order_discount,
     coalesce(v_rule.max_amount,v_gross-v_line_discount_total));
 end if;
 v_total:=round(v_gross-v_line_discount_total-v_order_discount,2);
 if v_total<=0 then raise exception 'La venta debe tener un total positivo'; end if;

 insert into public.restaurant_orders(
   organization_id,branch_id,session_id,client_token,business_date,
   gross_amount,discount_amount,total_amount,customer_id,created_by)
 values(v_session.organization_id,v_session.branch_id,p_session_id,p_client_token,
   timezone(v_org.timezone,now())::date,
   v_gross,v_line_discount_total+v_order_discount,v_total,p_customer_id,auth.uid())
 returning id into v_order_id;

 -- Segunda pasada con los mismos precios, congelando los conceptos en el ticket.
 for v_item in select value from jsonb_array_elements(p_items) loop
   select * into v_product from public.products
   where id=(v_item->>'product_id')::uuid and organization_id=v_session.organization_id;
   v_quantity:=(v_item->>'quantity')::numeric;
   v_base_price:=v_product.price;
   if exists(select 1 from public.restaurant_combo_components c
       where c.combo_product_id=v_product.id and c.organization_id=v_session.organization_id and c.price_mode='sum') then
     select round(sum(c.quantity*p.price),2) into v_base_price
     from public.restaurant_combo_components c join public.products p on p.id=c.component_product_id
     where c.combo_product_id=v_product.id and c.organization_id=v_session.organization_id;
   end if;
   v_addon_unit:=0;
   v_addons_snapshot:='[]'::jsonb;
   for v_addon in select value from jsonb_array_elements(coalesce(v_item->'addons','[]'::jsonb)) loop
     select * into v_addon_row from public.restaurant_product_addons
     where id=(v_addon->>'addon_id')::uuid and product_id=v_product.id
       and organization_id=v_session.organization_id;
     v_addon_unit:=v_addon_unit+v_addon_row.extra_price;
     v_addons_snapshot:=v_addons_snapshot || jsonb_build_array(
       jsonb_build_object('name',v_addon_row.name,'price',v_addon_row.extra_price));
   end loop;
   v_line_gross:=round(v_quantity*(v_base_price+v_addon_unit),2);
   v_line_discount:=0;
   if nullif(v_item->>'discount_rule_id','') is not null then
     select * into v_rule from public.restaurant_discount_rules
     where id=(v_item->>'discount_rule_id')::uuid
       and organization_id=v_session.organization_id;
     v_line_discount:=case when v_rule.mode='percent'
       then round(v_line_gross*v_rule.value/100,2) else v_rule.value end;
     v_line_discount:=least(v_line_gross,v_line_discount,
       coalesce(v_rule.max_amount,v_line_gross));
   end if;
   v_line_net:=v_line_gross-v_line_discount;
   insert into public.restaurant_order_items(
      organization_id,order_id,product_id,description,quantity,
      unit_price,addons,notes,discount_amount,line_total)
   values(v_session.organization_id,v_order_id,v_product.id,v_product.name,
      v_quantity,v_base_price,v_addons_snapshot,
      nullif(left(btrim(coalesce(v_item->>'notes','')),200),''),
      v_line_discount,v_line_net);
 end loop;

 for v_payment in select value from jsonb_array_elements(p_payments) loop
   v_payment_count:=v_payment_count+1;
   select * into v_method from public.restaurant_payment_methods
   where id=(v_payment->>'method_id')::uuid and organization_id=v_session.organization_id
     and active;
   if not found then raise exception 'Método de pago inválido'; end if;
   v_paid:=(v_payment->>'amount')::numeric;
   if v_paid is null or v_paid<=0 or v_paid<>round(v_paid,2) then
     raise exception 'Importe de cobro inválido'; end if;
   v_payment_sum:=v_payment_sum+v_paid;
   v_cash_movement_id:=null;
   if v_method.kind='cash' then
     insert into public.cash_movements(organization_id,branch_id,session_id,
        movement_type,reason_code,description,amount,created_by)
     values(v_session.organization_id,v_session.branch_id,p_session_id,
        'in','cash_in','Venta interna '||v_order_id::text,v_paid,auth.uid())
     returning id into v_cash_movement_id;
   end if;
   insert into public.restaurant_order_payments(
     organization_id,order_id,method_id,amount,verification_code,cash_movement_id)
   values(v_session.organization_id,v_order_id,v_method.id,v_paid,
     nullif(left(btrim(coalesce(v_payment->>'reference','')),120),''),
     v_cash_movement_id);
 end loop;
 if v_payment_count<1 or v_payment_sum<>v_total then
   raise exception 'La suma de los pagos debe coincidir exactamente con el total';
 end if;

 return v_order_id;
end $$;

revoke all on function public.restaurant_checkout(uuid,uuid,jsonb,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.restaurant_checkout(uuid,uuid,jsonb,jsonb,uuid,uuid) to authenticated;

create or replace function public.restaurant_reverse_order(
 p_order_id uuid,p_reason text
) returns uuid language plpgsql security definer
set search_path=public,auth set row_security=off as $$
declare v_order public.restaurant_orders%rowtype;
 v_timezone text; v_id uuid;
begin
 select * into v_order from public.restaurant_orders where id=p_order_id for update;
 if not found or not public.can_access_branch(v_order.organization_id,v_order.branch_id)
    or not public.is_org_owner(v_order.organization_id) then
   raise exception 'Venta no encontrada o acceso denegado';
 end if;
 if v_order.fiscal_sale_id is not null then
   raise exception 'La venta tiene un comprobante fiscal; se requiere regularización fiscal previa';
 end if;
 if length(btrim(coalesce(p_reason,'')))<3 then raise exception 'Motivo requerido'; end if;
 if exists(select 1 from public.restaurant_order_reversals where order_id=p_order_id) then
   raise exception 'La venta ya fue anulada'; end if;
 select timezone into v_timezone from public.organizations where id=v_order.organization_id;
 insert into public.restaurant_order_reversals(
   organization_id,order_id,business_date,reason,amount,created_by)
 values(v_order.organization_id,v_order.id,timezone(v_timezone,now())::date,
   btrim(p_reason),v_order.total_amount,auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.restaurant_reverse_order(uuid,text) from public,anon,authenticated;
grant execute on function public.restaurant_reverse_order(uuid,text) to authenticated;

create or replace function public.restaurant_refund_order(
 p_reversal_id uuid,p_method_id uuid,p_amount numeric,
 p_session_id uuid default null,p_reference text default null
) returns uuid language plpgsql security definer
set search_path=public,auth set row_security=off as $$
declare v_reversal public.restaurant_order_reversals%rowtype;
 v_order public.restaurant_orders%rowtype;
 v_method public.restaurant_payment_methods%rowtype;
 v_session public.sales_sessions%rowtype;
 v_paid numeric; v_id uuid; v_cash_id uuid;
begin
 select * into v_reversal from public.restaurant_order_reversals
 where id=p_reversal_id for update;
 if not found then raise exception 'Reversión inexistente'; end if;
 select * into v_order from public.restaurant_orders where id=v_reversal.order_id;
 if not public.is_org_owner(v_order.organization_id) or
    not public.can_access_branch(v_order.organization_id,v_order.branch_id) then
    raise exception 'Acceso denegado';
 end if;
 select * into v_method from public.restaurant_payment_methods
 where id=p_method_id and organization_id=v_order.organization_id and active;
 if not found then raise exception 'Método inválido'; end if;
 if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then
   raise exception 'Importe inválido'; end if;
 select coalesce(sum(amount),0) into v_paid
 from public.restaurant_order_refunds where reversal_id=v_reversal.id;
 if v_paid+p_amount>v_reversal.amount then
   raise exception 'La devolución supera el importe pendiente'; end if;
 v_cash_id:=null;
 if v_method.kind='cash' then
   if p_session_id is null then raise exception 'Se necesita una caja abierta para devolver efectivo'; end if;
   select * into v_session from public.sales_sessions
   where id=p_session_id and status='open' and branch_id=v_order.branch_id
     and organization_id=v_order.organization_id;
   if not found then raise exception 'Caja no disponible en el mismo local'; end if;
   v_cash_id:=public.register_cash_movement(p_session_id,'out','other',p_amount,
     'Devolución de venta interna '||v_order.id::text);
 end if;
 insert into public.restaurant_order_refunds(
  organization_id,reversal_id,payment_method_id,amount,session_id,
  cash_movement_id,reference_code,created_by)
 values(v_order.organization_id,v_reversal.id,p_method_id,p_amount,p_session_id,
  v_cash_id,nullif(left(btrim(coalesce(p_reference,'')),120),''),auth.uid())
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.restaurant_refund_order(uuid,uuid,numeric,uuid,text) from public,anon,authenticated;
grant execute on function public.restaurant_refund_order(uuid,uuid,numeric,uuid,text) to authenticated;


-- Precio calculado de combos para que el POS muestre lo mismo que cobra el servidor.
create view public.v_restaurant_pos_products with (security_invoker=true) as
select p.organization_id,p.id,p.name,p.category_id,p.price,
  case when exists(
    select 1 from public.restaurant_combo_components c
    where c.combo_product_id=p.id and c.organization_id=p.organization_id
      and c.price_mode='sum'
  ) then (
    select round(sum(c.quantity*cp.price),2)
    from public.restaurant_combo_components c
    join public.products cp on cp.id=c.component_product_id
    where c.combo_product_id=p.id and c.organization_id=p.organization_id
  ) else p.price end::numeric(12,2) as sale_price
from public.products p where p.active=true;
grant select on public.v_restaurant_pos_products to authenticated;

-- Amplía el resultado con ventas internas y anulaciones, sin sumar otra vez
-- un comprobante fiscal enlazado a la misma venta comercial.
create or replace view public.v_restaurant_result_movements
with (security_invoker=true) as
  select s.organization_id,s.branch_id,
    s.fiscal_issue_date as business_date,
    'sale'::text as movement_type,s.id as source_id,
    s.total_amount::numeric(14,2) as signed_amount
  from public.sales s
  where s.commercial_status='completed' and s.status='accepted'
    and not exists(select 1 from public.restaurant_orders r where r.fiscal_sale_id=s.id)
  union all
  select i.organization_id,i.branch_id,i.income_date,'other_income',i.id,i.amount
  from public.restaurant_other_income i
  union all
  select e.organization_id,e.branch_id,e.expense_date,'expense',e.id,
    (-e.amount)::numeric(14,2)
  from public.expenses e
  union all
  select e.organization_id,e.branch_id,
    timezone(o.timezone,e.voided_at)::date,'expense_reversal',e.id,
    e.amount::numeric(14,2)
  from public.expenses e
  join public.organizations o on o.id=e.organization_id
  where e.is_voided and e.voided_at is not null
  union all
  select a.organization_id,s.branch_id,a.adjusted_on,'sale_reversal',a.id,
    (-a.amount)::numeric(14,2)
  from public.restaurant_legacy_sale_adjustments a
  join public.sales s on s.id=a.sale_id and s.organization_id=a.organization_id
  union all
  select r.organization_id,r.branch_id,r.business_date,'internal_sale',r.id,
    r.total_amount::numeric(14,2)
  from public.restaurant_orders r
  union all
  select r.organization_id,o.branch_id,r.business_date,'internal_reversal',r.id,
    (-r.amount)::numeric(14,2)
  from public.restaurant_order_reversals r
  join public.restaurant_orders o on o.id=r.order_id;

-- La vista agregada 017 se actualiza para incluir los tipos nuevos como ingresos.
create or replace view public.v_restaurant_daily_result
with (security_invoker=true) as
select organization_id,branch_id,business_date,
 coalesce(sum(signed_amount) filter(where movement_type in
   ('sale','other_income','sale_reversal','internal_sale','internal_reversal')),0)::numeric(14,2) as income_amount,
 coalesce(-sum(signed_amount) filter(where movement_type in
   ('expense','expense_reversal')),0)::numeric(14,2) as expense_amount,
 coalesce(sum(signed_amount),0)::numeric(14,2) as result_amount
from public.v_restaurant_result_movements
group by organization_id,branch_id,business_date;

insert into public.schema_change_log(script_code,script_name,description)
values('018','ventas_internas','POS interno, pagos combinados, reversión de venta y devolución de caja sin modificar cierre anterior.');

commit;
