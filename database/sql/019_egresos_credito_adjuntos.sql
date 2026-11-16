-- 019_egresos_credito_adjuntos.sql
-- Aplicar en Supabase SQL Editor después de 018.
begin;

do $$
begin
 if exists(select 1 from public.schema_change_log where script_code='019') then
   raise exception '019 ya aplicado';
 end if;
 if not exists(select 1 from public.schema_change_log where script_code='018') then
   raise exception 'Ejecutar primero 018_ventas_internas.sql';
 end if;
end $$;

create or replace function public.restaurant_create_expense(
  p_branch_id uuid,p_date date,p_category_code text,
  p_description text,p_amount numeric,p_credit boolean default false,
  p_method_id uuid default null,p_notes text default null
) returns uuid language plpgsql security definer
set search_path=public,auth set row_security=off as $$
declare v_org uuid;v_timezone text;v_id uuid;
begin
 select b.organization_id,o.timezone into v_org,v_timezone
 from public.branches b join public.organizations o on o.id=b.organization_id
 where b.id=p_branch_id and b.active=true;
 if v_org is null or not public.is_org_owner(v_org)
    or not public.can_access_branch(v_org,p_branch_id) then
   raise exception 'Local inválido o acceso denegado';
 end if;
 if p_date is null or p_date > timezone(v_timezone,now())::date then
   raise exception 'Fecha de egreso inválida';
 end if;
 if p_amount is null or p_amount<>round(p_amount,2) or p_amount<=0 then
   raise exception 'Importe inválido';
 end if;
 if length(btrim(coalesce(p_description,''))) not between 3 and 200 then
   raise exception 'Descripción inválida';
 end if;
 if not exists(select 1 from public.restaurant_expense_categories
   where organization_id=v_org and code=lower(btrim(p_category_code)) and active=true) then
   raise exception 'Categoría inválida';
 end if;
 if p_method_id is not null and not exists(
   select 1 from public.restaurant_payment_methods
   where id=p_method_id and organization_id=v_org and active) then
   raise exception 'Método de pago inválido';
 end if;
 insert into public.expenses(
   organization_id,branch_id,expense_date,category,description,
   amount,notes,created_by,payment_terms,payment_method_id
 ) values(v_org,p_branch_id,p_date,lower(btrim(p_category_code)),
   btrim(p_description),p_amount,nullif(btrim(p_notes),''),auth.uid(),
   case when p_credit then 'credit' else 'paid' end,p_method_id)
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.restaurant_create_expense(uuid,date,text,text,numeric,boolean,uuid,text)
 from public,anon,authenticated;
grant execute on function public.restaurant_create_expense(uuid,date,text,text,numeric,boolean,uuid,text)
 to authenticated;

-- Deuda por egreso registrada: el abono no cambia el P&L.
create view public.v_restaurant_outstanding_expenses with (security_invoker=true) as
select e.id,e.organization_id,e.branch_id,e.expense_date,e.description,e.category,
  e.amount::numeric(14,2) as original_amount,
  coalesce(p.paid,0)::numeric(14,2) as paid_amount,
  (e.amount-coalesce(p.paid,0))::numeric(14,2) as pending_amount
from public.expenses e
left join lateral (
  select coalesce(sum(amount),0) as paid
  from public.restaurant_expense_payments p where p.expense_id=e.id
) p on true
where e.payment_terms='credit' and e.is_voided=false;
grant select on public.v_restaurant_outstanding_expenses to authenticated;

create table public.restaurant_expense_attachments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 expense_id uuid not null references public.expenses(id) on delete restrict,
 storage_path text not null unique,
 file_name text not null check(btrim(file_name)<>''),
 mime_type text not null check(mime_type in
   ('image/jpeg','image/png','image/webp','application/pdf')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create index restaurant_expense_attachments_expense_idx
 on public.restaurant_expense_attachments(expense_id);
alter table public.restaurant_expense_attachments enable row level security;
revoke all on public.restaurant_expense_attachments from anon,authenticated;
grant select,insert on public.restaurant_expense_attachments to authenticated;
create policy restaurant_expense_attachments_read
 on public.restaurant_expense_attachments for select to authenticated
 using(public.is_org_member(organization_id));
create policy restaurant_expense_attachments_add
 on public.restaurant_expense_attachments for insert to authenticated
 with check(
   public.is_org_owner(organization_id) and created_by=(select auth.uid())
   and exists(select 1 from public.expenses e where e.id=expense_id
     and e.organization_id=organization_id)
   and split_part(storage_path,'/',1)=organization_id::text
   and split_part(storage_path,'/',2)=expense_id::text
 );

-- Almacenamiento PRIVADO; los archivos no son públicos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('restaurant-expense-docs','restaurant-expense-docs',false,5242880,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;

create policy restaurant_expense_docs_read on storage.objects
 for select to authenticated
 using(
   bucket_id='restaurant-expense-docs'
   and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}
 );
create policy restaurant_expense_docs_upload on storage.objects
 for insert to authenticated
 with check(
   bucket_id='restaurant-expense-docs'
   and case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}
 );


-- Evitar anular una compra a crédito que ya tiene abonos y dejar deuda inconsistente.
create or replace function public.restaurant_prevent_void_paid_expense()
returns trigger language plpgsql set search_path=public as $
begin
  if new.is_voided and not old.is_voided and exists(
    select 1 from public.restaurant_expense_payments p where p.expense_id=old.id
  ) then
    raise exception 'La compra ya tiene abonos; requiere regularización de pagos antes de anular';
  end if;
  return new;
end $;
revoke all on function public.restaurant_prevent_void_paid_expense()
from public,anon,authenticated;
create trigger restaurant_prevent_void_paid_expense
before update on public.expenses for each row
execute function public.restaurant_prevent_void_paid_expense();

insert into public.schema_change_log(script_code,script_name,description)
values('019','egresos_credito_adjuntos','Alta de egresos simples, deuda por pagar y adjuntos privados opcionales.');

commit;

     then public.is_org_member(((storage.foldername(name))[1])::uuid)
     else false end
 );
create policy restaurant_expense_docs_upload on storage.objects
 for insert to authenticated
 with check(
   bucket_id='restaurant-expense-docs'
   and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
   and public.is_org_owner(((storage.foldername(name))[1])::uuid)
 );

insert into public.schema_change_log(script_code,script_name,description)
values('019','egresos_credito_adjuntos','Alta de egresos simples, deuda por pagar y adjuntos privados opcionales.');

commit;

     then public.is_org_owner(((storage.foldername(name))[1])::uuid)
     else false end
 );

insert into public.schema_change_log(script_code,script_name,description)
values('019','egresos_credito_adjuntos','Alta de egresos simples, deuda por pagar y adjuntos privados opcionales.');

commit;

     then public.is_org_member(((storage.foldername(name))[1])::uuid)
     else false end
 );
create policy restaurant_expense_docs_upload on storage.objects
 for insert to authenticated
 with check(
   bucket_id='restaurant-expense-docs'
   and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
   and public.is_org_owner(((storage.foldername(name))[1])::uuid)
 );

insert into public.schema_change_log(script_code,script_name,description)
values('019','egresos_credito_adjuntos','Alta de egresos simples, deuda por pagar y adjuntos privados opcionales.');

commit;
