-- 006_estandar_fechas_y_horas.sql
-- Estandariza el manejo temporal: instantes en timestamptz, fecha de negocio por zona horaria.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '006') then
    raise exception 'El script 006 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '005') then
    raise exception 'Debe ejecutar primero 005_vistas_reportes_iniciales.sql.';
  end if;
end
$$;

-- Valida zonas IANA (por ejemplo America/Lima) para evitar errores silenciosos en reportes.
create or replace function public.validate_organization_timezone()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception 'Zona horaria IANA inválida: %', new.timezone;
  end if;

  return new;
end;
$$;

create trigger organizations_validate_timezone
before insert or update of timezone on public.organizations
for each row execute function public.validate_organization_timezone();

-- Una fecha de egreso es una fecha de negocio, no un instante UTC.
-- Al omitirla, se calcula usando el reloj de PostgreSQL y la zona de la organización.
alter table public.expenses
  alter column expense_date drop default;

create or replace function public.set_expense_business_date()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
declare
  v_timezone text;
begin
  if new.expense_date is not null then
    return new;
  end if;

  select o.timezone
    into v_timezone
  from public.organizations o
  where o.id = new.organization_id;

  if v_timezone is null then
    raise exception 'No se encontró la zona horaria de la organización.';
  end if;

  new.expense_date := (pg_catalog.timezone(v_timezone, pg_catalog.now()))::date;
  return new;
end;
$$;

create trigger expenses_set_business_date
before insert on public.expenses
for each row execute function public.set_expense_business_date();

comment on column public.organizations.timezone is
  'Zona horaria IANA usada únicamente para fecha/hora de negocio y presentación. Los instantes se almacenan como timestamptz.';

comment on column public.expenses.expense_date is
  'Fecha calendario del negocio. Si se omite, se calcula en servidor con now() y organizations.timezone.';

comment on column public.sales.created_at is
  'Instante de creación generado por PostgreSQL. timestamptz representa un instante absoluto; presentar usando la zona del negocio.';

comment on column public.sales.issued_at is
  'Instante real de emisión del comprobante. Debe establecerse desde backend, nunca desde el reloj del navegador.';

revoke all on function public.validate_organization_timezone() from public, anon, authenticated;
revoke all on function public.set_expense_business_date() from public, anon, authenticated;

insert into public.schema_change_log (script_code, script_name, description)
values (
  '006',
  'estandar_fechas_y_horas',
  'Valida zonas IANA y calcula fechas de negocio desde el reloj del servidor y la zona de la organización.'
);

commit;
