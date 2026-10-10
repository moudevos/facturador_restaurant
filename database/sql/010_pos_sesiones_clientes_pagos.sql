-- 010_pos_sesiones_clientes_pagos.sql
-- Integra clientes, sesiones de caja, pagos y movimientos para el POS.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '010') then
    raise exception 'El script 010 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '009') then
    raise exception 'Debe ejecutar primero 009_egresos_financieros.sql.';
  end if;
end
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_type text not null check (document_type in ('1', '6')),
  document_number text not null,
  name text not null,
  phone text,
  email text,
  address text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_type, document_number),
  unique (id, organization_id)
);

create table public.sales_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  cashier_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_cash numeric(12,2) not null default 0 check (opening_cash >= 0),
  opening_note text,
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete restrict,
  closed_at timestamptz,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  cash_difference numeric(12,2),
  closing_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id)
    on delete restrict
);

create unique index sales_sessions_one_open_per_branch_idx
  on public.sales_sessions (branch_id)
  where status = 'open';

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sale_id uuid not null,
  session_id uuid not null,
  payment_method text not null check (payment_method in ('cash', 'yape', 'plin', 'card', 'transfer')),
  amount numeric(12,2) not null check (amount > 0),
  received_amount numeric(12,2),
  change_amount numeric(12,2) not null default 0 check (change_amount >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (sale_id, organization_id)
    references public.sales(id, organization_id)
    on delete restrict,
  foreign key (session_id, organization_id)
    references public.sales_sessions(id, organization_id)
    on delete restrict
);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  session_id uuid not null,
  movement_type text not null check (movement_type in ('in', 'out')),
  reason_code text not null check (
    reason_code in ('change', 'cash_in', 'safe_withdrawal', 'supplies', 'supplier_payment', 'other')
  ),
  description text,
  amount numeric(12,2) not null check (amount > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id)
    on delete restrict,
  foreign key (session_id, organization_id)
    references public.sales_sessions(id, organization_id)
    on delete restrict
);

alter table public.sales
  add column customer_id uuid,
  add column session_id uuid;

alter table public.sales
  add constraint sales_customer_org_fk
  foreign key (customer_id, organization_id)
  references public.customers(id, organization_id)
  on delete restrict;

alter table public.sales
  add constraint sales_session_org_fk
  foreign key (session_id, organization_id)
  references public.sales_sessions(id, organization_id)
  on delete restrict;

create index customers_org_name_idx on public.customers (organization_id, active, name);
create index sales_sessions_org_opened_idx on public.sales_sessions (organization_id, branch_id, opened_at desc);
create index sales_session_idx on public.sales (session_id, created_at desc) where session_id is not null;
create index sale_payments_session_idx on public.sale_payments (session_id, created_at desc);
create index cash_movements_session_idx on public.cash_movements (session_id, created_at desc);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger sales_sessions_set_updated_at
before update on public.sales_sessions
for each row execute function public.set_updated_at();

create trigger customers_audit
after insert or update or delete on public.customers
for each row execute function public.audit_row_change();

create trigger sales_sessions_audit
after insert or update or delete on public.sales_sessions
for each row execute function public.audit_row_change();

create trigger sale_payments_audit
after insert or update or delete on public.sale_payments
for each row execute function public.audit_row_change();

create trigger cash_movements_audit
after insert or update or delete on public.cash_movements
for each row execute function public.audit_row_change();

create trigger sale_payments_prevent_delete
before delete on public.sale_payments
for each row execute function public.prevent_financial_delete();

create trigger cash_movements_prevent_delete
before delete on public.cash_movements
for each row execute function public.prevent_financial_delete();

alter table public.customers enable row level security;
alter table public.sales_sessions enable row level security;
alter table public.sale_payments enable row level security;
alter table public.cash_movements enable row level security;

revoke all on table public.customers from anon, authenticated;
revoke all on table public.sales_sessions from anon, authenticated;
revoke all on table public.sale_payments from anon, authenticated;
revoke all on table public.cash_movements from anon, authenticated;

grant select on public.customers to authenticated;
grant select on public.sales_sessions to authenticated;
grant select on public.sale_payments to authenticated;
grant select on public.cash_movements to authenticated;

create policy customers_select_members on public.customers
for select to authenticated
using (public.is_org_member(organization_id));

create policy sales_sessions_select_branch_members on public.sales_sessions
for select to authenticated
using (public.can_access_branch(organization_id, branch_id));

create policy sale_payments_select_branch_members on public.sale_payments
for select to authenticated
using (
  exists (
    select 1
    from public.sales_sessions ss
    where ss.id = sale_payments.session_id
      and ss.organization_id = sale_payments.organization_id
      and public.can_access_branch(ss.organization_id, ss.branch_id)
  )
);

create policy cash_movements_select_branch_members on public.cash_movements
for select to authenticated
using (public.can_access_branch(organization_id, branch_id));

drop policy if exists document_sequences_select_owner on public.document_sequences;

create policy document_sequences_select_branch_members on public.document_sequences
for select to authenticated
using (public.can_access_branch(organization_id, branch_id));

create or replace function public.create_customer(
  p_organization_id uuid,
  p_document_type text,
  p_document_number text,
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_id uuid;
  v_doc text := trim(p_document_number);
  v_name text := trim(p_name);
begin
  if auth.uid() is null or not public.is_org_member(p_organization_id) then
    raise exception 'No tiene acceso a la organización.';
  end if;

  if p_document_type not in ('1', '6') then
    raise exception 'Tipo de documento inválido.';
  end if;

  if (p_document_type = '1' and v_doc !~ '^[0-9]{8}$')
     or (p_document_type = '6' and v_doc !~ '^[0-9]{11}$') then
    raise exception 'Número de documento inválido.';
  end if;

  if length(v_name) < 2 then
    raise exception 'Nombre o razón social inválido.';
  end if;

  insert into public.customers (
    organization_id, document_type, document_number, name,
    phone, email, address, created_by
  )
  values (
    p_organization_id, p_document_type, v_doc, v_name,
    nullif(trim(p_phone), ''), nullif(trim(p_email), ''), nullif(trim(p_address), ''), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.open_sales_session(
  p_branch_id uuid,
  p_cashier_user_id uuid,
  p_opening_cash numeric,
  p_opening_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_organization_id uuid;
  v_actor_role text;
  v_cashier_branch uuid;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  select b.organization_id into v_organization_id
  from public.branches b
  where b.id = p_branch_id and b.active = true;

  if v_organization_id is null or not public.can_access_branch(v_organization_id, p_branch_id) then
    raise exception 'No tiene acceso al local indicado.';
  end if;

  v_actor_role := public.current_user_role(v_organization_id);

  if v_actor_role <> 'owner' and p_cashier_user_id <> auth.uid() then
    raise exception 'Un cajero solo puede abrir su propia sesión.';
  end if;

  select om.branch_id into v_cashier_branch
  from public.organization_members om
  where om.organization_id = v_organization_id
    and om.user_id = p_cashier_user_id
    and om.active = true
  limit 1;

  if not found then
    raise exception 'El cajero no pertenece a la organización.';
  end if;

  if v_cashier_branch is not null and v_cashier_branch <> p_branch_id then
    raise exception 'El cajero está asignado a otro local.';
  end if;

  if coalesce(p_opening_cash, -1) < 0 then
    raise exception 'El fondo inicial no puede ser negativo.';
  end if;

  insert into public.sales_sessions (
    organization_id, branch_id, cashier_user_id, opening_cash,
    opening_note, opened_by
  )
  values (
    v_organization_id, p_branch_id, p_cashier_user_id, round(p_opening_cash, 2),
    nullif(trim(p_opening_note), ''), auth.uid()
  )
  returning id into v_session_id;

  return v_session_id;
exception
  when unique_violation then
    raise exception 'Ya existe una sesión abierta para este local.';
end;
$$;

create or replace function public.register_cash_movement(
  p_session_id uuid,
  p_movement_type text,
  p_reason_code text,
  p_amount numeric,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_session public.sales_sessions%rowtype;
  v_id uuid;
  v_expected numeric(12,2);
begin
  select * into v_session
  from public.sales_sessions
  where id = p_session_id
    and status = 'open';

  if not found then
    raise exception 'La sesión no existe o está cerrada.';
  end if;

  if not public.can_access_branch(v_session.organization_id, v_session.branch_id) then
    raise exception 'No tiene acceso a esta sesión.';
  end if;

  if auth.uid() <> v_session.cashier_user_id
     and not public.is_org_owner(v_session.organization_id) then
    raise exception 'Solo el cajero responsable o un propietario puede registrar movimientos.';
  end if;

  if p_movement_type not in ('in', 'out') then
    raise exception 'Tipo de movimiento inválido.';
  end if;

  if p_reason_code not in ('change', 'cash_in', 'safe_withdrawal', 'supplies', 'supplier_payment', 'other') then
    raise exception 'Motivo de movimiento inválido.';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;

  if p_movement_type = 'out' then
    select
      v_session.opening_cash
      + coalesce((
          select sum(sp.amount)
          from public.sale_payments sp
          join public.sales s on s.id = sp.sale_id
          where sp.session_id = v_session.id
            and sp.payment_method = 'cash'
            and s.status <> 'voided'
        ), 0)
      + coalesce((
          select sum(cm.amount)
          from public.cash_movements cm
          where cm.session_id = v_session.id and cm.movement_type = 'in'
        ), 0)
      - coalesce((
          select sum(cm.amount)
          from public.cash_movements cm
          where cm.session_id = v_session.id and cm.movement_type = 'out'
        ), 0)
    into v_expected;

    if p_amount > v_expected then
      raise exception 'La salida supera el efectivo esperado en caja.';
    end if;
  end if;

  insert into public.cash_movements (
    organization_id, branch_id, session_id, movement_type,
    reason_code, description, amount, created_by
  )
  values (
    v_session.organization_id, v_session.branch_id, v_session.id, p_movement_type,
    p_reason_code, nullif(trim(p_description), ''), round(p_amount, 2), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.close_sales_session(
  p_session_id uuid,
  p_counted_cash numeric,
  p_closing_note text default null
)
returns table (
  expected_cash numeric,
  counted_cash numeric,
  cash_difference numeric
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_session public.sales_sessions%rowtype;
  v_expected numeric(12,2);
  v_counted numeric(12,2);
  v_diff numeric(12,2);
begin
  select * into v_session
  from public.sales_sessions
  where id = p_session_id
    and status = 'open'
  for update;

  if not found then
    raise exception 'La sesión no existe o ya está cerrada.';
  end if;

  if not public.can_access_branch(v_session.organization_id, v_session.branch_id) then
    raise exception 'No tiene acceso a esta sesión.';
  end if;

  if auth.uid() <> v_session.cashier_user_id
     and not public.is_org_owner(v_session.organization_id) then
    raise exception 'Solo el cajero responsable o un propietario puede cerrar la sesión.';
  end if;

  if coalesce(p_counted_cash, -1) < 0 then
    raise exception 'El efectivo contado no puede ser negativo.';
  end if;

  select
    v_session.opening_cash
    + coalesce((
        select sum(sp.amount)
        from public.sale_payments sp
        join public.sales s on s.id = sp.sale_id
        where sp.session_id = v_session.id
          and sp.payment_method = 'cash'
          and s.status <> 'voided'
      ), 0)
    + coalesce((
        select sum(cm.amount)
        from public.cash_movements cm
        where cm.session_id = v_session.id and cm.movement_type = 'in'
      ), 0)
    - coalesce((
        select sum(cm.amount)
        from public.cash_movements cm
        where cm.session_id = v_session.id and cm.movement_type = 'out'
      ), 0)
  into v_expected;

  v_counted := round(p_counted_cash, 2);
  v_diff := round(v_counted - v_expected, 2);

  if abs(v_diff) >= 0.01 and length(trim(coalesce(p_closing_note, ''))) < 3 then
    raise exception 'Debe registrar una observación cuando existe diferencia de caja.';
  end if;

  update public.sales_sessions
  set status = 'closed',
      closed_by = auth.uid(),
      closed_at = now(),
      expected_cash = v_expected,
      counted_cash = v_counted,
      cash_difference = v_diff,
      closing_note = nullif(trim(p_closing_note), '')
  where id = v_session.id;

  return query select v_expected, v_counted, v_diff;
end;
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
  select * into v_session
  from public.sales_sessions
  where id = p_session_id
    and status = 'open';

  if not found then
    raise exception 'No existe una sesión de venta abierta.';
  end if;

  if not public.can_access_branch(v_session.organization_id, v_session.branch_id) then
    raise exception 'No tiene acceso a la sesión.';
  end if;

  if auth.uid() <> v_session.cashier_user_id
     and not public.is_org_owner(v_session.organization_id) then
    raise exception 'La sesión pertenece a otro cajero.';
  end if;

  if p_document_type not in ('01', '03') then
    raise exception 'Tipo de comprobante inválido.';
  end if;

  if p_payment_method not in ('cash', 'yape', 'plin', 'card', 'transfer') then
    raise exception 'Método de pago inválido.';
  end if;

  if p_customer_id is not null then
    select * into v_customer
    from public.customers
    where id = p_customer_id
      and organization_id = v_session.organization_id
      and active = true;

    if not found then
      raise exception 'Cliente no válido.';
    end if;
  end if;

  if p_document_type = '01'
     and (p_customer_id is null or v_customer.document_type <> '6') then
    raise exception 'La factura requiere un cliente con RUC.';
  end if;

  select
    d.sale_id, d.correlative, d.taxable_amount, d.igv_amount, d.total_amount
  into
    v_sale_id, v_correlative, v_taxable, v_igv, v_total
  from public.create_sale_draft(
    v_session.branch_id,
    p_document_type,
    upper(p_series),
    case when p_customer_id is null then null else v_customer.document_type end,
    case when p_customer_id is null then null else v_customer.document_number end,
    case when p_customer_id is null then null else v_customer.name end,
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
    organization_id, sale_id, session_id, payment_method,
    amount, received_amount, change_amount, created_by
  )
  values (
    v_session.organization_id, v_sale_id, v_session.id, p_payment_method,
    v_total, v_received, v_change, auth.uid()
  );

  return query
  select v_sale_id, upper(p_series), v_correlative, v_taxable, v_igv, v_total, v_change;
end;
$$;

create view public.v_sales_session_summary
with (security_invoker = true)
as
select
  ss.id as session_id,
  ss.organization_id,
  ss.branch_id,
  ss.cashier_user_id,
  ss.status,
  ss.opening_cash,
  ss.opening_note,
  ss.opened_at,
  ss.closed_at,
  ss.expected_cash as closed_expected_cash,
  ss.counted_cash,
  ss.cash_difference,
  ss.closing_note,
  coalesce(sales_stats.sales_count, 0)::bigint as sales_count,
  coalesce(sales_stats.total_sales, 0)::numeric(14,2) as total_sales,
  coalesce(sales_stats.cash_sales, 0)::numeric(14,2) as cash_sales,
  coalesce(sales_stats.yape_sales, 0)::numeric(14,2) as yape_sales,
  coalesce(sales_stats.plin_sales, 0)::numeric(14,2) as plin_sales,
  coalesce(sales_stats.card_sales, 0)::numeric(14,2) as card_sales,
  coalesce(sales_stats.transfer_sales, 0)::numeric(14,2) as transfer_sales,
  coalesce(move_stats.cash_in, 0)::numeric(14,2) as cash_in,
  coalesce(move_stats.cash_out, 0)::numeric(14,2) as cash_out,
  (
    ss.opening_cash
    + coalesce(sales_stats.cash_sales, 0)
    + coalesce(move_stats.cash_in, 0)
    - coalesce(move_stats.cash_out, 0)
  )::numeric(14,2) as current_expected_cash
from public.sales_sessions ss
left join lateral (
  select
    count(distinct s.id) as sales_count,
    coalesce(sum(sp.amount), 0) as total_sales,
    coalesce(sum(sp.amount) filter (where sp.payment_method = 'cash'), 0) as cash_sales,
    coalesce(sum(sp.amount) filter (where sp.payment_method = 'yape'), 0) as yape_sales,
    coalesce(sum(sp.amount) filter (where sp.payment_method = 'plin'), 0) as plin_sales,
    coalesce(sum(sp.amount) filter (where sp.payment_method = 'card'), 0) as card_sales,
    coalesce(sum(sp.amount) filter (where sp.payment_method = 'transfer'), 0) as transfer_sales
  from public.sales s
  join public.sale_payments sp on sp.sale_id = s.id
  where s.session_id = ss.id
    and s.status <> 'voided'
) sales_stats on true
left join lateral (
  select
    coalesce(sum(cm.amount) filter (where cm.movement_type = 'in'), 0) as cash_in,
    coalesce(sum(cm.amount) filter (where cm.movement_type = 'out'), 0) as cash_out
  from public.cash_movements cm
  where cm.session_id = ss.id
) move_stats on true;

create view public.v_daily_collections
with (security_invoker = true)
as
select
  sp.organization_id,
  s.branch_id,
  timezone(o.timezone, sp.created_at)::date as business_date,
  count(distinct s.id)::bigint as sales_count,
  coalesce(sum(sp.amount), 0)::numeric(14,2) as collected_amount
from public.sale_payments sp
join public.sales s on s.id = sp.sale_id
join public.organizations o on o.id = sp.organization_id
where s.status <> 'voided'
group by
  sp.organization_id,
  s.branch_id,
  timezone(o.timezone, sp.created_at)::date;

grant select on public.v_sales_session_summary to authenticated;
grant select on public.v_daily_collections to authenticated;

revoke all on function public.create_customer(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.open_sales_session(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.register_cash_movement(uuid, text, text, numeric, text) from public, anon, authenticated;
revoke all on function public.close_sales_session(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.create_pos_sale(uuid, text, text, uuid, jsonb, text, numeric) from public, anon, authenticated;

grant execute on function public.create_customer(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.open_sales_session(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.register_cash_movement(uuid, text, text, numeric, text) to authenticated;
grant execute on function public.close_sales_session(uuid, numeric, text) to authenticated;
grant execute on function public.create_pos_sale(uuid, text, text, uuid, jsonb, text, numeric) to authenticated;

comment on table public.sales_sessions is
  'Sesiones de caja por local. Solo puede existir una sesión abierta por local.';
comment on table public.cash_movements is
  'Movimientos físicos de efectivo. No todos los movimientos representan egresos financieros.';
comment on table public.sale_payments is
  'Pagos cobrados en el POS. La estructura admite múltiples filas por venta aunque el MVP use un método principal.';

insert into public.schema_change_log (script_code, script_name, description)
values (
  '010',
  'pos_sesiones_clientes_pagos',
  'Clientes, sesiones de caja, pagos, movimientos, vistas operativas y RPCs del POS.'
);

commit;
