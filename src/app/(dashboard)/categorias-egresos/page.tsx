import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Tags } from "lucide-react";
import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

async function createCategory(form:FormData) {
  "use server";
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/categorias-egresos?estado=permiso");
  const code=String(form.get("code")??"").trim().toLowerCase();
  const name=String(form.get("name")??"").trim();
  if(!/^[a-z0-9_]{2,40}$/.test(code)||name.length<2||name.length>80)
    redirect("/categorias-egresos?estado=datos");
  const supabase=await createClient();
  const {error}=await supabase.from("restaurant_expense_categories").insert({
    organization_id:context.organizationId,code,name,active:true,
  });
  if(error)redirect("/categorias-egresos?estado=error");
  revalidatePath("/categorias-egresos");
  revalidatePath("/egresos/registro");
  redirect("/categorias-egresos?estado=guardado");
}

async function updateCategory(form:FormData) {
  "use server";
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/categorias-egresos?estado=permiso");
  const id=String(form.get("id")??"");
  const name=String(form.get("name")??"").trim();
  const active=form.get("active")==="on";
  if(!/^[0-9a-f-]{36}$/i.test(id)||name.length<2||name.length>80)
    redirect("/categorias-egresos?estado=datos");
  const supabase=await createClient();
  const {error}=await supabase.from("restaurant_expense_categories")
    .update({name,active}).eq("id",id).eq("organization_id",context.organizationId);
  if(error)redirect("/categorias-egresos?estado=error");
  revalidatePath("/categorias-egresos");
  revalidatePath("/egresos/registro");
  redirect("/categorias-egresos?estado=guardado");
}

export default async function CategoriasEgresoPage({
  searchParams,
}:{
  searchParams:Promise<{estado?:string}>;
}) {
  const context=await getSalesContext();
  if(!context)redirect("/configuracion");
  const {estado}=await searchParams;
  const supabase=await createClient();
  const {data,error}=await supabase.from("restaurant_expense_categories")
    .select("id,code,name,active")
    .eq("organization_id",context.organizationId).order("name");
  return <section className="mx-auto max-w-5xl space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Configuración financiera</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[#14201b] sm:text-3xl">
        <Tags className="size-6 text-orange-600" aria-hidden="true"/> Categorías de egresos
      </h1>
      <p className="mt-2 text-sm text-[#63746a]">
        Organiza las compras y gastos. Desactivar una categoría no modifica registros anteriores.
      </p>
    </header>
    {estado==="guardado"?<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Categoría guardada.</p>:null}
    {estado&&estado!=="guardado"?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">No se pudo guardar. Revisa los datos o el código duplicado.</p>:null}
    {error?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Comprueba SQL 017.</p>:null}
    {context.role==="owner"?<form action={createCategory} className="rounded-2xl border border-[#e8e3d7] bg-white p-5">
      <h2 className="mb-4 font-extrabold text-[#14201b]">Nueva categoría</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Código interno
          <input name="code" required minLength={2} maxLength={40} pattern="[a-z0-9_]{2,40}"
            placeholder="ej. alquiler" className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Nombre
          <input name="name" required minLength={2} maxLength={80}
            placeholder="Ej. Alquiler" className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
        </label>
      </div>
      <button type="submit" className="mt-4 min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white">Crear categoría</button>
    </form>:null}
    <div className="grid gap-3 sm:grid-cols-2">
      {(data??[]).map(category=><form key={category.id} action={updateCategory}
        className="space-y-3 rounded-2xl border border-[#e8e3d7] bg-white p-4">
        <input type="hidden" name="id" value={category.id}/>
        <p className="text-xs text-[#63746a]">{category.code}</p>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Nombre
          <input name="name" required minLength={2} maxLength={80} defaultValue={category.name}
            disabled={context.role!=="owner"} className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input name="active" type="checkbox" defaultChecked={category.active}
              disabled={context.role!=="owner"} className="size-4 accent-orange-600"/> Activa
          </label>
          {context.role==="owner"?<button type="submit" className="min-h-11 rounded-xl bg-[#14201b] px-4 text-sm font-bold text-white">Guardar</button>:null}
        </div>
      </form>)}
    </div>
  </section>;
}
