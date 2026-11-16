import Link from "next/link";
import { redirect } from "next/navigation";
import { Layers3, Plus } from "lucide-react";

import {
  addComboComponent, addProductAddon, changeComboMode,
  removeComboComponent, updateProductAddon,
} from "@/features/restaurant/actions/catalog";
import { getSalesContext } from "@/features/sales/server/context";
import { formatMoney } from "@/features/sales/utils/format";
import { createClient } from "@/lib/supabase/server";

export default async function CombosPage({
  searchParams,
}:{
  searchParams:Promise<{estado?:string}>;
}) {
  const context=await getSalesContext();
  if(!context)redirect("/configuracion");
  const {estado}=await searchParams;
  const supabase=await createClient();
  const [pRes,componentsRes,addonsRes]=await Promise.all([
    supabase.from("products").select("id,name,price,active")
      .eq("organization_id",context.organizationId).eq("active",true).order("name"),
    supabase.from("restaurant_combo_components")
      .select("id,combo_product_id,component_product_id,quantity,price_mode")
      .eq("organization_id",context.organizationId),
    supabase.from("restaurant_product_addons")
      .select("id,product_id,name,extra_price,active")
      .eq("organization_id",context.organizationId).order("name"),
  ]);
  const products=pRes.data??[];
  const components=componentsRes.data??[];
  const addons=addonsRes.data??[];
  const byId=new Map(products.map(p=>[p.id,p]));
  const comboIds=[...new Set(components.map(c=>c.combo_product_id))];
  const canEdit=context.role==="owner";

  return <section className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Catálogo</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[#14201b] sm:text-3xl">
          <Layers3 className="size-6 text-orange-600" aria-hidden="true"/> Combos y adicionales
        </h1>
        <p className="mt-2 text-sm text-[#63746a]">
          Un combo es un producto del catálogo con componentes. Su precio puede ser fijo
          o la suma de sus componentes. Los adicionales pueden costar S/ 0.
        </p>
      </div>
      <Link href="/productos" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-bold">
        Administrar productos
      </Link>
    </header>
    {estado==="guardado"?<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Configuración guardada.</p>:null}
    {estado&&estado!=="guardado"?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">No se pudo guardar. Revisa datos y permisos.</p>:null}
    {[pRes,componentsRes,addonsRes].some(q=>q.error)?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Comprueba SQL 017.</p>:null}

    {canEdit?<div className="grid gap-4 lg:grid-cols-2">
      <form action={addComboComponent} className="space-y-4 rounded-2xl border border-[#e8e3d7] bg-white p-5">
        <h2 className="flex items-center gap-2 font-extrabold text-[#14201b]"><Plus className="size-5 text-orange-600"/> Añadir componente a un combo</h2>
        <p className="text-xs text-[#63746a]">Primero crea el producto combo en Productos; luego selecciona sus componentes.</p>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Producto combo
          <select name="combo" required className="min-h-11 rounded-xl border bg-white px-3 text-sm font-normal">
            {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Producto incluido
          <select name="component" required className="min-h-11 rounded-xl border bg-white px-3 text-sm font-normal">
            {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-[#53645a]">Cantidad
            <input required type="number" name="quantity" step="0.001" min="0.001" max="100" defaultValue="1"
              className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
          </label>
          <label className="grid gap-1 text-xs font-bold text-[#53645a]">Precio del combo
            <select name="mode" defaultValue="fixed" className="min-h-11 rounded-xl border bg-white px-3 text-sm font-normal">
              <option value="fixed">Precio fijo del producto</option>
              <option value="sum">Suma de componentes</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={!products.length} className="min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white disabled:opacity-50">
          Agregar componente
        </button>
      </form>

      <form action={addProductAddon} className="space-y-4 rounded-2xl border border-[#e8e3d7] bg-white p-5">
        <h2 className="flex items-center gap-2 font-extrabold text-[#14201b]"><Plus className="size-5 text-orange-600"/> Crear adicional</h2>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Producto al que aplica
          <select name="product" required className="min-h-11 rounded-xl border bg-white px-3 text-sm font-normal">
            {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Nombre
          <input name="name" required minLength={2} maxLength={100} placeholder="Ej. Queso extra / Sin ají"
            className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Precio adicional S/
          <input name="price" type="number" required min="0" step="0.01" defaultValue="0.00"
            className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
        </label>
        <button type="submit" disabled={!products.length} className="min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white disabled:opacity-50">
          Crear adicional
        </button>
      </form>
    </div>:null}

    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#14201b]">Combos configurados</h2>
        {comboIds.map(comboId=>{
          const combo=byId.get(comboId);
          const items=components.filter(x=>x.combo_product_id===comboId);
          const mode=items.some(x=>x.price_mode==="sum")?"sum":"fixed";
          const computed=items.reduce((sum,item)=>sum+Number(byId.get(item.component_product_id)?.price??0)*Number(item.quantity),0);
          return <article key={comboId} className="space-y-3 rounded-2xl border border-[#e8e3d7] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-[#14201b]">{combo?.name??"Producto inactivo"}</h3>
                <p className="text-xs text-[#63746a]">Precio actual: {formatMoney(mode==="sum"?computed:Number(combo?.price??0))}</p>
              </div>
              {canEdit?<form action={changeComboMode} className="flex items-center gap-2">
                <input type="hidden" name="combo" value={comboId}/>
                <select name="mode" defaultValue={mode} aria-label="Forma de calcular el precio"
                  className="min-h-10 rounded-lg border bg-white px-2 text-xs">
                  <option value="fixed">Fijo</option>
                  <option value="sum">Suma</option>
                </select>
                <button type="submit" className="min-h-10 rounded-lg bg-[#14201b] px-3 text-xs font-bold text-white">Cambiar</button>
              </form>:null}
            </div>
            {items.map(item=><div key={item.id} className="flex items-center justify-between gap-3 border-t pt-2 text-sm">
              <span>{Number(item.quantity)} × {byId.get(item.component_product_id)?.name??"Producto"}</span>
              {canEdit?<form action={removeComboComponent}>
                <input type="hidden" name="id" value={item.id}/>
                <button type="submit" className="min-h-10 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700">Quitar</button>
              </form>:null}
            </div>)}
          </article>;
        })}
        {!comboIds.length?<p className="rounded-2xl border bg-white p-5 text-sm text-[#63746a]">No hay combos configurados.</p>:null}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#14201b]">Adicionales configurados</h2>
        {addons.map(addon=><form key={addon.id} action={updateProductAddon}
          className="space-y-3 rounded-2xl border border-[#e8e3d7] bg-white p-4">
          <input type="hidden" name="id" value={addon.id}/>
          <p className="text-xs font-bold text-[#63746a]">{byId.get(addon.product_id)?.name??"Producto"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-[#53645a]">Nombre
              <input name="name" required minLength={2} maxLength={100} defaultValue={addon.name}
                className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
            </label>
            <label className="grid gap-1 text-xs font-bold text-[#53645a]">Precio S/
              <input name="price" required type="number" min="0" step="0.01"
                defaultValue={addon.extra_price} className="min-h-11 rounded-xl border px-3 text-sm font-normal"/>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="active" defaultChecked={addon.active} className="size-4 accent-orange-600"/> Activo
            </label>
            {canEdit?<button type="submit" className="min-h-11 rounded-xl bg-[#14201b] px-4 text-sm font-bold text-white">Guardar</button>:null}
          </div>
        </form>)}
        {!addons.length?<p className="rounded-2xl border bg-white p-5 text-sm text-[#63746a]">No hay adicionales configurados.</p>:null}
      </section>
    </div>
  </section>;
}
