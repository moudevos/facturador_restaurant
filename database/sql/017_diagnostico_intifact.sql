-- 017_diagnostico_intifact.sql
-- Persistir HTTP 4xx/5xx de Intifact sin perder el error de validación.
-- No modifica correlativos ni crea nuevos documentos.
begin;

do $$
begin
  if exists (
    select 1 from public.schema_change_log where script_code = '017'
  ) then
    raise exception 'El script 017 ya fue aplicado.';
  end if;

  if not exists (
    select 1 from public.schema_change_log where script_code = '016'
  ) then
    raise exception 'Debe ejecutar primero 016_clientes_manuales_y_cliente_generico.sql.';
  end if;
end;
$$;

alter table public.sales
  add column intifact_last_http_status integer
    check (intifact_last_http_status between 100 and 599),
  add column intifact_error_response jsonb,
  add column intifact_error_response_at timestamptz;

comment on column public.sales.intifact_last_http_status is
  'Último código HTTP de Intifact ante un error de envío.';
comment on column public.sales.intifact_error_response is
  'Diagnóstico HTTP y cuerpo de error del proveedor, con campos secretos redactados. No contiene request ni API key; solo se consulta para diagnóstico.';
comment on column public.sales.intifact_error_response_at is
  'Momento UTC de captura del error HTTP de Intifact.';

insert into public.schema_change_log (script_code, script_name, description)
values (
  '017',
  'diagnostico_intifact',
  'Conserva los errores HTTP y los mensajes por campo de Intifact sin editar correlativos.'
);

commit;
