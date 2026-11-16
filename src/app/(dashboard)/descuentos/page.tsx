import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BadgePercent, Plus } from "lucide-react";
import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

const scopes = [
  { value: "line", label: "Por producto" },
  { value: "sale", label: "Al total de la venta" },
  { value: "both", label: "Ambos" },
] as const;
const modes = [
  { value: "percent", label: "Porcentaje (%)" },
  { value: "fixed", label: "Importe fijo (S/)" },
] as const;

function validated(formData: FormData) {
  const name=String(formData.get("name")??"").trim();
  const scope=String(formData.get("scope")??"");
  const mode=String(formData.get("mode")??"");
  const valueText=String(formData.get("value")??"");
  const maxText=String(formData.get("max_amount")??"").trim();
  const numeric=/^\d+(\.\d{1,2})?$/;
  if(name.length<2||name.length>100||
     !scopes.some(s=>s.value===scope)||!modes.some(m=>m.value===mode)||
     !numeric.test(valueText)||Number(valueText)<0||
     (mode==="percent"&&Number(valueText)>100)||
     (maxText!==""&&(!numeric.test(maxText)||Number(maxText)<0))) {
    return null;
  }
  return {
    name,scope,mode,value:Number(valueText),
    max_amount:maxText===""?null:Number(maxText),
    active:formData.get("active")==="on",
  };
}

async function createDiscount(formData: FormData) {
  "use server";
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/descuentos?estado=permiso");
  const input=validated(formData);
  if(!input)redirect("/descuentos?estado=datos");
  const supabase=await createClient();
  const {error}=await supabase.from("restaurant_discount_rules")
    .insert({...input,organization_id:context.organizationId,active:true});
  if(error)redirect("/descuentos?estado=error");
  revalidatePath("/descuentos");
  revalidatePath("/pos-rapido");
  redirect("/descuentos?estado=guardado");
}

async function updateDiscount(formData: FormData) {
  "use server";
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/descuentos?estado=permiso");
  const id=String(formData.get("id")??"");
  const input=validated(formData);
  if(!/^[0-9a-f-]{36}$/i.test(id)||!input)redirect("/descuentos?estado=datos");
  const supabase=await createClient();
  const {error}=await supabase.from("restaurant_discount_rules")
    .update(input).eq("id",id).eq("organization_id",context.organizationId);
  if(error)redirect("/descuentos?estado=error");
  revalidatePath("/descuentos");
  revalidatePath("/pos-rapido");
  redirect("/descuentos?estado=guardado");
}

function RuleFields({
  initial,
}:{
  initial?:{name:string;scope:string;mode:string;value:number|string;max_amount:number|string|null;active:boolean};
}) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <label className="grid gap-1 text-xs font-bold text-[#53645a]">Nombre
      <input required name="name" minLength={2} maxLength={100} defaultValue={initial?.name??""}
        className="min-h-11 rounded-xl border border-[#dad9d0] px-3 text-sm font-normal focus-visible:outline-2 focus-visible:outline-orange-600"/>
    </label>
    <label className="grid gap-1 text-xs font-bold text-[#53645a]">Aplicación
      <select name="scope" defaultValue={initial?.scope??"both"} className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-2 text-sm font-normal">
        {scopes.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-xs font-bold text-[#53645a]">Tipo
      <select name="mode" defaultValue={initial?.mode??"percent"} className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-2 text-sm font-normal">
        {modes.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </label>
    <label className="grid gap-1 text-xs font-bold text-[#53645a]">Valor
      <input required name="value" type="number" step="0.01" min="0"
        defaultValue={initial?.value??0} className="min-h-11 rounded-xl border border-[#dad9d0] px-3 text-sm font-normal"/>
    </label>
    <label className="grid gap-1 text-xs font-bold text-[#53645a]">Máximo en S/ (opcional)
      <input name="max_amount" type="number" step="0.01" min="0"
        defaultValue={initial?.max_amount??""} className="min-h-11 rounded-xl border border-[#dad9d0] px-3 text-sm font-normal"/>
    </label>
  </div>;
}

export default async function DescuentosPage({
  searchParams,
}:{
  searchParams:Promise<{estado?:string}>;
}) {
  const context=await getSalesContext();
  if(!context)redirect("/configuracion");
  const {estado}=await searchParams;
  const supabase=await createClient();
  const {data,error}=await supabase.from("restaurant_discount_rules")
    .select("id,name,scope,mode,value,max_amount,active")
    .eq("organization_id",context.organizationId).order("created_at",{ascending:false});

  return <section className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Configuración</p>
      <h1 className="mt-1 text-2xl font-extrabold text-[#14201b] sm:text-3xl">Descuentos</h1>
      <p className="mt-2 text-sm text-[#63746a]">Crea reglas por producto o venta. El POS valida los importes en el servidor.</p>
    </header>
    {estado==="guardado"?<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Descuento guardado.</p>:null}
    {estado&&estado!=="guardado"?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">No se guardó el descuento. Comprueba los importes y permisos.</p>:null}
    {error?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Comprueba SQL 017 en Supabase.</p>:null}

    {context.role==="owner"?<form action={createDiscount} className="space-y-4 rounded-2xl border border-[#e8e3d7] bg-white p-5">
      <h2 className="flex items-center gap-2 font-extrabold text-[#14201b]"><Plus className="size-5 text-orange-600"/> Nueva regla</h2>
      <RuleFields/>
      <button type="submit" className="min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white">Crear descuento</button>
    </form>:null}

    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-extrabold text-[#14201b]">
        <BadgePercent className="size-5 text-orange-600"/> Reglas configuradas
      </h2>
      {(data??[]).map(rule=><form key={rule.id} action={updateDiscount}
        className="space-y-3 rounded-2xl border border-[#e8e3d7] bg-white p-5">
        <input type="hidden" name="id" value={rule.id}/>
        <RuleFields initial={rule}/>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-[#35423c]">
            <input type="checkbox" name="active" defaultChecked={rule.active} className="size-4 accent-orange-600"/>
            Activo en el POS
          </label>
          {context.role==="owner"?<button type="submit" className="min-h-11 rounded-xl bg-[#14201b] px-5 text-sm font-bold text-white">
            Guardar cambios
          </button>:null}
        </div>
      </form>)}
      {!data?.length?<p className="rounded-xl bg-white p-5 text-sm text-[#63746a]">No hay descuentos configurados.</p>:null}
    </section>
  </section>;
}
