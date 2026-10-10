-- 009_egresos_financieros.sql
-- Endurece egresos: categorías estables, anulación irreversible, resumen filtrado e índices.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '009') then
    raise exception 'El script 009 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '008') then
    raise exception 'Debe ejecutar primero 008_productos_catalogo.sql.';
  end if;
end
$$;

DO $$
begin
  if exists (
    select 1
    from public.expenses
    where category not in ('compras', 'servicios', 'personal', 'transporte', 'mantenimiento', 'otros')
  ) then
    raise exception 'Existen egresos con categorías fuera del catálogo permitido. Revise esos registros antes de aplicar 009.';
  end if;

  if exists (
    select 1
    from public.expenses
    where btrim(description) = ''
  ) then
    raise exception 'Existen egresos con descripción vacía. Corríjalos antes de aplicar 009.';
  end if;
end
$$;

alter table public.expenses
  add constraint expenses_category_check
  check (category in ('compras', 'servicios', 'personal', 'transporte', 'mantenimiento', 'otros'));

alter table public.expenses
  add constraint expenses_description_not_blank_check
  check (btrim(description) <> '');

create or replace function public.normalize_expense_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.category := lower(btrim(new.category));
  new.description := btrim(new.description);
  new.notes := nullif(btrim(new.notes), '');
  return new;
end;
$$;

create trigger expenses_normalize_fields
before insert on public.expenses
for each row execute function public.normalize_expense_fields();

create or replace function public.guard_expense_financial_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_voided then
    raise exception 'Un egreso anulado no puede modificarse.';
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.branch_id is distinct from old.branch_id
     or new.expense_date is distinct from old.expense_date
     or new.category is distinct from old.category
     or new.description is distinct from old.description
     or new.amount is distinct from old.amount
     or new.notes is distinct from old.notes
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Los datos financieros de un egreso no se editan. Anule el egreso y registre uno nuevo.';
  end if;

  if new.is_voided is not true
     or new.voided_at is null
     or new.voided_by is null then
    raise exception 'La única actualización permitida es la anulación completa del egreso.';
  end if;

  return new;
end;
$$;

create trigger expenses_guard_financial_update
before update on public.expenses
for each row execute function public.guard_expense_financial_update();

create or replace function public.void_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_organization_id uuid;
  v_is_voided boolean;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  select e.organization_id, e.is_voided
    into v_organization_id, v_is_voided
  from public.expenses e
  where e.id = p_expense_id;

  if v_organization_id is null then
    raise exception 'Egreso no encontrado.';
  end if;

  if not public.is_org_owner(v_organization_id) then
    raise exception 'Solo un propietario puede anular egresos.';
  end if;

  if v_is_voided then
    raise exception 'El egreso ya está anulado.';
  end if;

  update public.expenses
  set is_voided = true,
      voided_at = now(),
      voided_by = auth.uid()
  where id = p_expense_id;
end;
$$;

create or replace function public.expense_filtered_summary(
  p_organization_id uuid,
  p_branch_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_category text default null,
  p_status text default 'active',
  p_query text default null
)
returns table (
  record_count bigint,
  total_amount numeric
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
  if not public.is_org_member(p_organization_id) then
    raise exception 'No pertenece a la organización indicada.';
  end if;

  if p_status not in ('active', 'voided', 'all') then
    raise exception 'Estado de egreso inválido.';
  end if;

  return query
  select
    count(*)::bigint,
    coalesce(sum(e.amount), 0)::numeric(14,2)
  from public.expenses e
  where e.organization_id = p_organization_id
    and public.can_access_branch(e.organization_id, e.branch_id)
    and (p_branch_id is null or e.branch_id = p_branch_id)
    and (p_date_from is null or e.expense_date >= p_date_from)
    and (p_date_to is null or e.expense_date <= p_date_to)
    and (p_category is null or e.category = p_category)
    and (
      p_status = 'all'
      or (p_status = 'active' and e.is_voided = false)
      or (p_status = 'voided' and e.is_voided = true)
    )
    and (
      v_query is null
      or e.description ilike '%' || v_query || '%'
      or coalesce(e.notes, '') ilike '%' || v_query || '%'
    );
end;
$$;

create index expenses_org_filter_idx
  on public.expenses (organization_id, expense_date desc, is_voided, category, branch_id);

revoke update on public.expenses from authenticated;

revoke all on function public.normalize_expense_fields() from public, anon, authenticated;
revoke all on function public.guard_expense_financial_update() from public, anon, authenticated;
revoke all on function public.void_expense(uuid) from public, anon, authenticated;
revoke all on function public.expense_filtered_summary(uuid, uuid, date, date, text, text, text)
  from public, anon, authenticated;

grant execute on function public.void_expense(uuid) to authenticated;
grant execute on function public.expense_filtered_summary(uuid, uuid, date, date, text, text, text)
  to authenticated;

comment on column public.expenses.expense_date is
  'Fecha de negocio del egreso. Es independiente de created_at, que registra cuándo se ingresó al sistema.';

insert into public.schema_change_log (script_code, script_name, description)
values (
  '009',
  'egresos_financieros',
  'Categorías estables, anulación irreversible, resumen filtrado e índices para el módulo de egresos.'
);

commit;
