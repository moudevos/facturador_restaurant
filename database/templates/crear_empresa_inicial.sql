-- PLANTILLA DE DATOS INICIALES. NO FORMA PARTE DE LA SECUENCIA DE CAMBIOS DE ESQUEMA.
-- 1) Crear primero al usuario propietario desde Supabase Auth.
-- 2) Reemplazar TODOS los valores CAMBIAR_*.
-- 3) Ejecutar una única vez y guardar el resultado en la documentación operativa del negocio.

DO $$
declare
  v_owner_email text := 'CAMBIAR_EMAIL';
  v_legal_name text := 'CAMBIAR_RAZON_SOCIAL';
  v_trade_name text := 'CAMBIAR_NOMBRE_COMERCIAL';
  v_ruc text := 'CAMBIAR_RUC';
  v_branch_name text := 'Principal';
  v_branch_code text := '001';
  v_series text := 'B001';
  v_user_id uuid;
  v_organization_id uuid;
  v_branch_id uuid;
begin
  if v_owner_email like 'CAMBIAR_%' or v_ruc like 'CAMBIAR_%' then
    raise exception 'Debe editar la plantilla antes de ejecutarla.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_owner_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No existe un usuario Auth con el correo %', v_owner_email;
  end if;

  insert into public.organizations (legal_name, trade_name, ruc)
  values (v_legal_name, v_trade_name, v_ruc)
  returning id into v_organization_id;

  insert into public.branches (organization_id, code, name)
  values (v_organization_id, v_branch_code, v_branch_name)
  returning id into v_branch_id;

  insert into public.organization_members (organization_id, user_id, branch_id, role)
  values (v_organization_id, v_user_id, v_branch_id, 'owner');

  insert into public.document_sequences (organization_id, branch_id, document_type, series, current_value)
  values (v_organization_id, v_branch_id, '03', v_series, 0);

  raise notice 'organization_id=% branch_id=% owner_user_id=%', v_organization_id, v_branch_id, v_user_id;
end
$$;
