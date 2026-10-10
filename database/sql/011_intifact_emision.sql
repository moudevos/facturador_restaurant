-- 011_intifact_emision.sql
-- Snapshot fiscal por item y metadatos de sincronización Intifact sin webhooks.

begin;

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '011') then
    raise exception 'El script 011 ya fue aplicado.';
  end if;
  if not exists (select 1 from public.schema_change_log where script_code = '010') then
    raise exception 'Debe ejecutar primero 010_pos_sesiones_clientes_pagos.sql.';
  end if;
end
$$;

alter table public.sale_items
  add column tax_affectation_code text;

-- Para ventas previas a 011 se toma el valor actual del producto.
-- Desde 011 en adelante queda congelado al momento de crear la venta.
update public.sale_items si
set tax_affectation_code = p.tax_affectation_code
from public.products p
where p.id = si.product_id
  and p.organization_id = si.organization_id
  and si.tax_affectation_code is null;

DO $$
begin
  if exists (
    select 1
    from public.sale_items
    where tax_affectation_code is null
  ) then
    raise exception
      'No se pudo determinar la afectación IGV de uno o más items históricos. Revise esos registros antes de aplicar 011.';
  end if;
end
$$;

alter table public.sale_items
  alter column tax_affectation_code set not null,
  add constraint sale_items_tax_affectation_code_check
    check (tax_affectation_code in ('10', '20', '30'));

comment on column public.sale_items.tax_affectation_code is
  'Snapshot de la afectación IGV del producto al momento de la venta. No depende de cambios posteriores del catálogo.';

alter table public.sales
  add column intifact_payload_hash text,
  add column intifact_attempt_count integer not null default 0
    check (intifact_attempt_count >= 0),
  add column intifact_last_attempt_at timestamptz,
  add column intifact_last_checked_at timestamptz,
  add column intifact_error_message text,
  add column intifact_sunat_code text,
  add column intifact_sunat_description text;

comment on column public.sales.intifact_hash is
  'Hash devuelto por Intifact para el documento.';
comment on column public.sales.intifact_payload_hash is
  'SHA-256 del payload JSON enviado a Intifact para trazabilidad e idempotencia.';
comment on column public.sales.intifact_last_checked_at is
  'Última consulta de estado realizada a Intifact. En plan sin webhooks se actualiza mediante polling.';
comment on column public.sales.intifact_attempt_count is
  'Cantidad de intentos de envío fiscal realizados para la misma identidad RUC/tipo/serie/correlativo.';

alter table public.branches
  add column sunat_establishment_code text not null default '0000'
    check (sunat_establishment_code ~ '^[0-9]{4}$');

comment on column public.branches.sunat_establishment_code is
  'Código de establecimiento SUNAT usado por Intifact. 0000 corresponde al establecimiento principal.';

create index sales_intifact_pending_idx
  on public.sales (organization_id, status, created_at)
  where status in ('draft', 'queued', 'processing', 'queue_failed', 'error');

create or replace function public.create_sale_draft(
  p_branch_id uuid,
  p_document_type text,
  p_series text,
  p_customer_document_type text default null,
  p_customer_document_number text default null,
  p_customer_name text default null,
  p_items jsonb default '[]'::jsonb
)
returns table (
  sale_id uuid,
  correlative bigint,
  taxable_amount numeric,
  igv_amount numeric,
  total_amount numeric
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_organization_id uuid;
  v_sale_id uuid := gen_random_uuid();
  v_correlative bigint;
  v_expected_items integer;
  v_inserted_items integer;
  v_taxable numeric(12,2);
  v_igv numeric(12,2);
  v_total numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe contener al menos un producto.';
  end if;

  select b.organization_id
  into v_organization_id
  from public.branches b
  where b.id = p_branch_id
    and b.active = true;

  if v_organization_id is null or not public.can_access_branch(v_organization_id, p_branch_id) then
    raise exception 'No tiene acceso al local indicado.';
  end if;

  update public.document_sequences ds
  set current_value = current_value + 1
  where ds.branch_id = p_branch_id
    and ds.organization_id = v_organization_id
    and ds.document_type = p_document_type
    and ds.series = upper(p_series)
    and ds.active = true
  returning current_value into v_correlative;

  if v_correlative is null then
    raise exception 'No existe una serie activa para el tipo de documento solicitado.';
  end if;

  insert into public.sales (
    id, organization_id, branch_id, document_type, series, correlative,
    customer_document_type, customer_document_number, customer_name, created_by
  ) values (
    v_sale_id, v_organization_id, p_branch_id, p_document_type, upper(p_series), v_correlative,
    nullif(trim(p_customer_document_type), ''),
    nullif(trim(p_customer_document_number), ''),
    nullif(trim(p_customer_name), ''),
    auth.uid()
  );

  v_expected_items := jsonb_array_length(p_items);

  insert into public.sale_items (
    sale_id, organization_id, product_id, description, unit_code,
    tax_affectation_code,
    quantity, unit_price, line_subtotal, line_igv, line_total
  )
  select
    v_sale_id,
    v_organization_id,
    p.id,
    p.name,
    p.unit_code,
    p.tax_affectation_code,
    x.quantity,
    p.price,
    round(
      case
        when p.tax_affectation_code = '10'
          then (p.price * x.quantity) / 1.18
        else p.price * x.quantity
      end,
      2
    ),
    round(
      case
        when p.tax_affectation_code = '10'
          then (p.price * x.quantity) - ((p.price * x.quantity) / 1.18)
        else 0
      end,
      2
    ),
    round(p.price * x.quantity, 2)
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric)
  join public.products p
    on p.id = x.product_id
   and p.organization_id = v_organization_id
   and p.active = true
  where x.quantity > 0;

  get diagnostics v_inserted_items = row_count;

  if v_inserted_items <> v_expected_items then
    raise exception 'Uno o más productos no existen, están inactivos o tienen cantidad inválida.';
  end if;

  select
    coalesce(sum(si.line_subtotal), 0),
    coalesce(sum(si.line_igv), 0),
    coalesce(sum(si.line_total), 0)
  into v_taxable, v_igv, v_total
  from public.sale_items si
  where si.sale_id = v_sale_id;

  update public.sales
  set taxable_amount = v_taxable,
      igv_amount = v_igv,
      total_amount = v_total
  where id = v_sale_id;

  return query select v_sale_id, v_correlative, v_taxable, v_igv, v_total;
end;
$$;

insert into public.schema_change_log (script_code, script_name, description)
values (
  '011',
  'intifact_emision',
  'Snapshot de afectación IGV por item, código de establecimiento SUNAT y metadatos para emisión/polling Intifact sin webhooks.'
);

commit;
