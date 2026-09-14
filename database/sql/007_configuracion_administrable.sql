-- 007_configuracion_administrable.sql
-- Habilita el onboarding y la administración segura de empresa, series y usuarios.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '007') then
    raise exception 'El script 007 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '006') then
    raise exception 'Debe ejecutar primero 006_estandar_fechas_y_horas.sql.';
  end if;
end
$$;

create or replace function public.initialize_organization(
  p_legal_name text,
  p_trade_name text,
  p_ruc text,
  p_branch_name text,
  p_branch_address text default null,
  p_branch_ubigeo text default null,
  p_timezone text default 'America/Lima'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_branch_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if exists (
    select 1 from public.organization_members om
    where om.user_id = v_user_id
  ) then
    raise exception 'El usuario ya pertenece a una organización.';
  end if;

  if trim(p_legal_name) = '' then
    raise exception 'La razón social es obligatoria.';
  end if;

  if p_ruc !~ '^[0-9]{11}$' then
    raise exception 'El RUC debe contener exactamente 11 dígitos.';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Zona horaria inválida.';
  end if;

  insert into public.organizations (legal_name, trade_name, ruc, timezone)
  values (
    trim(p_legal_name),
    nullif(trim(p_trade_name), ''),
    p_ruc,
    p_timezone
  )
  returning id into v_organization_id;

  insert into public.branches (
    organization_id,
    code,
    name,
    address,
    ubigeo
  ) values (
    v_organization_id,
    '001',
    trim(p_branch_name),
    nullif(trim(p_branch_address), ''),
    nullif(trim(p_branch_ubigeo), '')
  )
  returning id into v_branch_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    branch_id,
    role,
    active
  ) values (
    v_organization_id,
    v_user_id,
    null,
    'owner',
    true
  );

  insert into public.document_sequences (
    organization_id,
    branch_id,
    document_type,
    series,
    current_value,
    active
  ) values (
    v_organization_id,
    v_branch_id,
    '03',
    'B001',
    0,
    true
  );

  return v_organization_id;
end;
$$;

create or replace function public.create_document_sequence(
  p_organization_id uuid,
  p_branch_id uuid,
  p_document_type text,
  p_series text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_id uuid;
  v_series text := upper(trim(p_series));
begin
  if not public.is_org_owner(p_organization_id) then
    raise exception 'Solo un propietario puede crear series.';
  end if;

  if p_document_type not in ('01', '03') then
    raise exception 'Tipo de documento inválido.';
  end if;

  if v_series !~ '^[A-Z0-9]{4}$' then
    raise exception 'La serie debe tener exactamente 4 caracteres alfanuméricos.';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = p_organization_id
      and b.active = true
  ) then
    raise exception 'El local no existe o está inactivo.';
  end if;

  insert into public.document_sequences (
    organization_id,
    branch_id,
    document_type,
    series,
    current_value,
    active
  ) values (
    p_organization_id,
    p_branch_id,
    p_document_type,
    v_series,
    0,
    true
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.set_document_sequence_active(
  p_organization_id uuid,
  p_sequence_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.is_org_owner(p_organization_id) then
    raise exception 'Solo un propietario puede modificar series.';
  end if;

  update public.document_sequences
  set active = p_active,
      updated_at = now()
  where id = p_sequence_id
    and organization_id = p_organization_id;

  if not found then
    raise exception 'Serie no encontrada.';
  end if;
end;
$$;

create or replace function public.list_organization_members(p_organization_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  email text,
  role text,
  branch_id uuid,
  active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
begin
  if not public.is_org_owner(p_organization_id) then
    raise exception 'Solo un propietario puede consultar todos los usuarios.';
  end if;

  return query
  select
    om.id,
    om.user_id,
    u.email::text,
    om.role,
    om.branch_id,
    om.active,
    om.created_at
  from public.organization_members om
  join auth.users u on u.id = om.user_id
  where om.organization_id = p_organization_id
  order by om.created_at;
end;
$$;

create or replace function public.add_org_member_by_email(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_user_id uuid;
  v_member_id uuid;
begin
  if not public.is_org_owner(p_organization_id) then
    raise exception 'Solo un propietario puede administrar usuarios.';
  end if;

  if p_role not in ('owner', 'cashier') then
    raise exception 'Rol inválido.';
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'El usuario no existe en Supabase Auth. Créelo o invítalo primero.';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = p_organization_id
      and b.active = true
  ) then
    raise exception 'Local inválido.';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    branch_id,
    role,
    active
  ) values (
    p_organization_id,
    v_user_id,
    p_branch_id,
    p_role,
    true
  )
  on conflict (organization_id, user_id)
  do update set
    branch_id = excluded.branch_id,
    role = excluded.role,
    active = true
  returning id into v_member_id;

  return v_member_id;
end;
$$;

create or replace function public.update_org_member_settings(
  p_organization_id uuid,
  p_member_id uuid,
  p_role text,
  p_branch_id uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_current_role text;
  v_current_active boolean;
  v_other_owners integer;
begin
  if not public.is_org_owner(p_organization_id) then
    raise exception 'Solo un propietario puede administrar usuarios.';
  end if;

  if p_role not in ('owner', 'cashier') then
    raise exception 'Rol inválido.';
  end if;

  select om.role, om.active
  into v_current_role, v_current_active
  from public.organization_members om
  where om.id = p_member_id
    and om.organization_id = p_organization_id;

  if v_current_role is null then
    raise exception 'Usuario de organización no encontrado.';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.organization_id = p_organization_id
      and b.active = true
  ) then
    raise exception 'Local inválido.';
  end if;

  if v_current_role = 'owner' and (p_role <> 'owner' or p_active = false) then
    select count(*)
    into v_other_owners
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.role = 'owner'
      and om.active = true
      and om.id <> p_member_id;

    if v_other_owners = 0 then
      raise exception 'No se puede desactivar o degradar al último propietario activo.';
    end if;
  end if;

  update public.organization_members
  set role = p_role,
      branch_id = p_branch_id,
      active = p_active
  where id = p_member_id
    and organization_id = p_organization_id;
end;
$$;

-- Los miembros se administran únicamente mediante las funciones anteriores.
revoke insert, update on public.organization_members from authenticated;

revoke all on function public.initialize_organization(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_document_sequence(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_document_sequence_active(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.list_organization_members(uuid) from public, anon, authenticated;
revoke all on function public.add_org_member_by_email(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.update_org_member_settings(uuid, uuid, text, uuid, boolean) from public, anon, authenticated;

grant execute on function public.initialize_organization(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_document_sequence(uuid, uuid, text, text) to authenticated;
grant execute on function public.set_document_sequence_active(uuid, uuid, boolean) to authenticated;
grant execute on function public.list_organization_members(uuid) to authenticated;
grant execute on function public.add_org_member_by_email(uuid, text, text, uuid) to authenticated;
grant execute on function public.update_org_member_settings(uuid, uuid, text, uuid, boolean) to authenticated;

create trigger document_sequences_audit
after insert or update or delete on public.document_sequences
for each row execute function public.audit_row_change();

insert into public.schema_change_log (script_code, script_name, description)
values ('007', 'configuracion_administrable', 'Onboarding y administración segura de empresa, series y usuarios desde la aplicación.');

commit;
