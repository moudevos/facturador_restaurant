-- 001_esquema_inicial.sql
-- Crea las tablas base del MVP. Ejecutar una sola vez desde Supabase SQL Editor.

begin;

create extension if not exists pgcrypto;

create table if not exists public.schema_change_log (
  script_code text primary key,
  script_name text not null,
  description text,
  executed_at timestamptz not null default now(),
  executed_by text not null default current_user
);

DO $$
begin
  if exists (select 1 from public.schema_change_log where script_code = '001') then
    raise exception 'El script 001 ya fue aplicado. No debe ejecutarse nuevamente.';
  end if;
end
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  ruc text not null unique check (ruc ~ '^[0-9]{11}$'),
  timezone text not null default 'America/Lima',
  currency text not null default 'PEN' check (currency = 'PEN'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  address text,
  ubigeo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (id, organization_id)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid,
  role text not null check (role in ('owner', 'cashier')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id)
    on delete restrict
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sku text,
  name text not null,
  description text,
  unit_code text not null default 'NIU',
  price numeric(12,2) not null check (price >= 0),
  tax_affectation_code text not null default '10',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

comment on column public.products.price is 'Precio final de venta, incluyendo impuestos cuando corresponda.';

create table public.document_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  document_type text not null check (document_type in ('01', '03')),
  series text not null check (series ~ '^[A-Z0-9]{4}$'),
  current_value bigint not null default 0 check (current_value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, document_type, series),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id)
    on delete restrict
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  document_type text not null default '03' check (document_type in ('01', '03')),
  series text not null check (series ~ '^[A-Z0-9]{4}$'),
  correlative bigint not null check (correlative > 0),
  status text not null default 'draft' check (
    status in ('draft', 'queued', 'processing', 'accepted', 'rejected', 'queue_failed', 'voided', 'error')
  ),
  currency text not null default 'PEN' check (currency = 'PEN'),
  customer_document_type text,
  customer_document_number text,
  customer_name text,
  taxable_amount numeric(12,2) not null default 0 check (taxable_amount >= 0),
  igv_amount numeric(12,2) not null default 0 check (igv_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  intifact_document_id text,
  intifact_status text,
  intifact_hash text,
  issued_at timestamptz,
  accepted_at timestamptz,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, document_type, series, correlative),
  unique (id, organization_id),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id)
    on delete restrict
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  product_id uuid,
  description text not null,
  unit_code text not null default 'NIU',
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_subtotal numeric(12,2) not null check (line_subtotal >= 0),
  line_igv numeric(12,2) not null check (line_igv >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  foreign key (sale_id, organization_id)
    references public.sales(id, organization_id)
    on delete restrict,
  foreign key (product_id, organization_id)
    references public.products(id, organization_id)
    on delete restrict
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  branch_id uuid not null,
  expense_date date not null default current_date,
  category text not null default 'compras',
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  is_voided boolean not null default false,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references public.branches(id, organization_id)
    on delete restrict
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'intifact',
  delivery_id text not null unique,
  event_type text,
  signature_valid boolean not null default false,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

insert into public.schema_change_log (script_code, script_name, description)
values ('001', 'esquema_inicial', 'Tablas base para organizaciones, locales, usuarios, productos, ventas, egresos, webhooks y auditoría.');

commit;
