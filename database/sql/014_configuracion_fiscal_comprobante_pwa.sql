-- 014_configuracion_fiscal_comprobante_pwa.sql
-- Verificación fiscal del emisor, configuración de comprobante y establecimientos SUNAT.
-- Ejecutar manualmente después de 013.

begin;

do $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '014') then
    raise exception 'El script 014 ya fue aplicado.';
  end if;

  if not exists (select 1 from public.schema_change_log where script_code = '013') then
    raise exception 'Debe ejecutar primero 013_comprobantes_fiscales.sql.';
  end if;
end
$$;

alter table public.organizations
  add column fiscal_verified boolean not null default false,
  add column fiscal_verified_at timestamptz,
  add column fiscal_verification_source text,
  add column sunat_status text,
  add column sunat_condition text,
  add column fiscal_address text,
  add column fiscal_ubigeo text,
  add column intifact_company_id text,
  add column intifact_company_verified_at timestamptz;

comment on column public.organizations.fiscal_verified is
  'RUC/nombre legal verificados server-side con ApiPeru.';
comment on column public.organizations.intifact_company_id is
  'ID de empresa emisora Intifact cuyo RUC coincide con organizations.ruc.';

-- 011 creó todos los locales con 0000. Desde 014 solo la matriz debe conservarlo.
alter table public.branches
  alter column sunat_establishment_code drop not null,
  alter column sunat_establishment_code drop default;

with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by created_at, id
    ) as rn
  from public.branches
  where sunat_establishment_code = '0000'
)
update public.branches b
set sunat_establishment_code = null
from ranked r
where r.id = b.id
  and r.rn > 1;

create unique index branches_org_sunat_establishment_unique_idx
  on public.branches (organization_id, sunat_establishment_code)
  where sunat_establishment_code is not null;

create table public.receipt_settings (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  logo_path text,
  footer_text text,
  paper_width text not null default '48'
    check (paper_width in ('48', '58', '80', 'a4')),
  printer_mode text not null default 'system'
    check (printer_mode in ('system', 'bluetooth-ble', 'android-bridge')),
  auto_print boolean not null default false,
  show_product_code boolean not null default false,
  show_payment_method boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.receipt_settings enable row level security;
revoke all on table public.receipt_settings from anon, authenticated;
grant select, insert, update on public.receipt_settings to authenticated;

create policy receipt_settings_select_members
on public.receipt_settings
for select to authenticated
using (public.is_org_member(organization_id));

create policy receipt_settings_write_owner
on public.receipt_settings
for all to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

create trigger receipt_settings_set_updated_at
before update on public.receipt_settings
for each row execute function public.set_updated_at();

insert into public.receipt_settings (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

create or replace function public.seed_receipt_settings_for_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.receipt_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

revoke all on function public.seed_receipt_settings_for_new_organization()
from public, anon, authenticated;

create trigger organizations_seed_receipt_settings
after insert on public.organizations
for each row execute function public.seed_receipt_settings_for_new_organization();

-- La identidad fiscal deja de ser editable directamente desde el navegador.
revoke update on public.organizations from authenticated;
grant update (trade_name, timezone) on public.organizations to authenticated;

create or replace function public.apply_verified_fiscal_profile(
  p_organization_id uuid,
  p_ruc text,
  p_legal_name text,
  p_sunat_status text,
  p_sunat_condition text,
  p_fiscal_address text,
  p_fiscal_ubigeo text,
  p_intifact_company_id text
)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_current_ruc text;
  v_verified boolean;
  v_sales_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not public.is_org_owner(p_organization_id) then
    raise exception 'Solo un propietario puede verificar el emisor.';
  end if;

  if p_ruc !~ '^[0-9]{11}$' then
    raise exception 'RUC inválido.';
  end if;

  if btrim(p_legal_name) = '' then
    raise exception 'El nombre legal es obligatorio.';
  end if;

  select ruc, fiscal_verified
  into v_current_ruc, v_verified
  from public.organizations
  where id = p_organization_id
  for update;

  if v_current_ruc is null then
    raise exception 'Organización no encontrada.';
  end if;

  select count(*)
  into v_sales_count
  from public.sales
  where organization_id = p_organization_id;

  if v_verified
     and v_current_ruc <> p_ruc
     and v_sales_count > 0 then
    raise exception
      'No se puede cambiar el RUC verificado de una organización que ya tiene ventas.';
  end if;

  update public.organizations
  set ruc = p_ruc,
      legal_name = btrim(p_legal_name),
      fiscal_verified = true,
      fiscal_verified_at = now(),
      fiscal_verification_source = 'apiperu',
      sunat_status = nullif(btrim(p_sunat_status), ''),
      sunat_condition = nullif(btrim(p_sunat_condition), ''),
      fiscal_address = nullif(btrim(p_fiscal_address), ''),
      fiscal_ubigeo = nullif(btrim(p_fiscal_ubigeo), ''),
      intifact_company_id = nullif(btrim(p_intifact_company_id), ''),
      intifact_company_verified_at =
        case
          when nullif(btrim(p_intifact_company_id), '') is null then null
          else now()
        end
  where id = p_organization_id;
end;
$$;

revoke all on function public.apply_verified_fiscal_profile(
  uuid, text, text, text, text, text, text, text
) from public, anon;

grant execute on function public.apply_verified_fiscal_profile(
  uuid, text, text, text, text, text, text, text
) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'organization-assets',
  'organization-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.schema_change_log (script_code, script_name, description)
values (
  '014',
  'configuracion_fiscal_comprobante_pwa',
  'Verificación fiscal ApiPeru/Intifact, configuración de comprobante, logo e importación de establecimientos SUNAT.'
);

commit;
