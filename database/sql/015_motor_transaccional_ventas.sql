-- 015_motor_transaccional_ventas.sql
-- Una operación POS solo impacta ventas/caja después de aceptación fiscal.
-- Ejecutar manualmente después de 014.

begin;

do $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '015') then
    raise exception 'El script 015 ya fue aplicado.';
  end if;

  if not exists (select 1 from public.schema_change_log where script_code = '014') then
    raise exception 'Debe ejecutar primero 014_configuracion_fiscal_comprobante_pwa.sql.';
  end if;
end
$$;

alter table public.sales
  add column commercial_status text not null default 'pending'
    check (commercial_status in ('pending', 'completed', 'failed', 'voided')),
  add column commercial_completed_at timestamptz,
  add column commercial_failed_at timestamptz,
  add column commercial_failure_reason text;

alter table public.sale_payments
  add column status text not null default 'pending'
    check (status in ('pending', 'completed', 'reversed')),
  add column completed_at timestamptz,
  add column reversed_at timestamptz,
  add column reversal_reason text;

-- Backfill conservador. Solo SUNAT accepted cuenta como venta/cobro efectivo.
update public.sales
set commercial_status =
  case
    when status = 'accepted' then 'completed'
    when status = 'rejected' then 'failed'
    when status = 'voided' then 'voided'
    else 'pending'
  end,
  commercial_completed_at =
    case when status = 'accepted' then coalesce(accepted_at, issued_at, created_at) else null end,
  commercial_failed_at =
    case when status = 'rejected' then coalesce(intifact_last_checked_at, updated_at, created_at) else null end,
  commercial_failure_reason =
    case
      when status = 'rejected'
        then coalesce(intifact_sunat_description, intifact_error_message, 'Comprobante rechazado por SUNAT.')
      else null
    end;

update public.sale_payments sp
set status =
  case
    when s.status = 'accepted' then 'completed'
    when s.status in ('rejected', 'voided') then 'reversed'
    else 'pending'
  end,
  completed_at =
    case when s.status = 'accepted' then coalesce(s.accepted_at, sp.created_at) else null end,
  reversed_at =
    case when s.status in ('rejected', 'voided') then coalesce(s.intifact_last_checked_at, sp.created_at) else null end,
  reversal_reason =
    case
      when s.status = 'rejected' then coalesce(s.intifact_sunat_description, 'Rechazo fiscal.')
      when s.status = 'voided' then 'Venta anulada.'
      else null
    end
from public.sales s
where s.id = sp.sale_id
  and s.organization_id = sp.organization_id;

create index sales_commercial_status_idx
  on public.sales (organization_id, commercial_status, created_at desc);

create index sale_payments_status_idx
  on public.sale_payments (organization_id, status, created_at desc);

comment on column public.sales.commercial_status is
  'Estado operativo/comercial separado del estado fiscal. Solo completed impacta ventas/caja.';
comment on column public.sale_payments.status is
  'pending hasta aceptación fiscal; completed impacta caja; reversed queda excluido de caja.';

create or replace function public.finalize_sale_after_fiscal_acceptance(
  p_sale_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_sale public.sales%rowtype;
  v_now timestamptz := now();
begin
  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada.';
  end if;

  if v_sale.status <> 'accepted' then
    raise exception 'La venta todavía no está aceptada fiscalmente.';
  end if;

  if v_sale.commercial_status = 'completed' then
    return;
  end if;

  if v_sale.commercial_status in ('failed', 'voided') then
    raise exception 'La venta ya tiene un estado comercial terminal.';
  end if;

  update public.sales
  set commercial_status = 'completed',
      commercial_completed_at = coalesce(commercial_completed_at, v_now),
      commercial_failed_at = null,
      commercial_failure_reason = null
  where id = p_sale_id;

  update public.sale_payments
  set status = 'completed',
      completed_at = coalesce(completed_at, v_now),
      reversed_at = null,
      reversal_reason = null
  where sale_id = p_sale_id
    and organization_id = v_sale.organization_id
    and status = 'pending';
end;
$$;

revoke all on function public.finalize_sale_after_fiscal_acceptance(uuid)
from public, anon, authenticated;
grant execute on function public.finalize_sale_after_fiscal_acceptance(uuid)
to service_role;

create or replace function public.reverse_sale_after_fiscal_failure(
  p_sale_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_sale public.sales%rowtype;
  v_now timestamptz := now();
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'La emisión fiscal no se completó.');
begin
  select *
  into v_sale
  from public.sales
  where id = p_sale_id
  for update;

  if not found then
    raise exception 'Venta no encontrada.';
  end if;

  if v_sale.status not in ('rejected', 'error') then
    raise exception 'Solo se puede revertir un rechazo o error fiscal definitivo.';
  end if;

  if v_sale.commercial_status = 'failed' then
    return;
  end if;

  if v_sale.commercial_status = 'completed' then
    raise exception 'Una venta completada no puede revertirse por este flujo.';
  end if;

  update public.sales
  set commercial_status = 'failed',
      commercial_failed_at = coalesce(commercial_failed_at, v_now),
      commercial_failure_reason = v_reason
  where id = p_sale_id;

  update public.sale_payments
  set status = 'reversed',
      reversed_at = coalesce(reversed_at, v_now),
      reversal_reason = v_reason
  where sale_id = p_sale_id
    and organization_id = v_sale.organization_id
    and status = 'pending';
end;
$$;

revoke all on function public.reverse_sale_after_fiscal_failure(uuid, text)
from public, anon, authenticated;
grant execute on function public.reverse_sale_after_fiscal_failure(uuid, text)
to service_role;

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
            and sp.status = 'completed'
            and s.commercial_status = 'completed'
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
  v_pending_count bigint;
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

  select count(*)
  into v_pending_count
  from public.sales s
  where s.session_id = v_session.id
    and s.commercial_status = 'pending';

  if v_pending_count > 0 then
    raise exception
      'Hay % venta(s) pendientes de confirmación fiscal. Actualice sus estados antes de cerrar la sesión.',
      v_pending_count;
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
          and sp.status = 'completed'
          and s.commercial_status = 'completed'
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

drop view if exists public.v_sales_session_summary;

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
  coalesce(pending_stats.pending_sales_count, 0)::bigint as pending_sales_count,
  coalesce(pending_stats.pending_sales_amount, 0)::numeric(14,2) as pending_sales_amount,
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
  join public.sale_payments sp
    on sp.sale_id = s.id
   and sp.organization_id = s.organization_id
  where s.session_id = ss.id
    and s.commercial_status = 'completed'
    and sp.status = 'completed'
) sales_stats on true
left join lateral (
  select
    count(*) as pending_sales_count,
    coalesce(sum(s.total_amount), 0) as pending_sales_amount
  from public.sales s
  where s.session_id = ss.id
    and s.commercial_status = 'pending'
) pending_stats on true
left join lateral (
  select
    coalesce(sum(cm.amount) filter (where cm.movement_type = 'in'), 0) as cash_in,
    coalesce(sum(cm.amount) filter (where cm.movement_type = 'out'), 0) as cash_out
  from public.cash_movements cm
  where cm.session_id = ss.id
) move_stats on true;

create or replace view public.v_daily_collections
with (security_invoker = true)
as
select
  sp.organization_id,
  s.branch_id,
  s.fiscal_issue_date as business_date,
  count(distinct s.id)::bigint as sales_count,
  coalesce(sum(sp.amount), 0)::numeric(14,2) as collected_amount
from public.sale_payments sp
join public.sales s
  on s.id = sp.sale_id
 and s.organization_id = sp.organization_id
where s.commercial_status = 'completed'
  and s.status = 'accepted'
  and sp.status = 'completed'
group by
  sp.organization_id,
  s.branch_id,
  s.fiscal_issue_date;

grant select on public.v_sales_session_summary to authenticated;
grant select on public.v_daily_collections to authenticated;

insert into public.schema_change_log (script_code, script_name, description)
values (
  '015',
  'motor_transaccional_ventas',
  'Separa estado fiscal/comercial/pago. Solo ventas aceptadas impactan caja, sesiones, dashboard y reportes operativos.'
);

commit;
