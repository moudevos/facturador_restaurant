import Link from "next/link";
import { redirect } from "next/navigation";
import { Paperclip, ReceiptText } from "lucide-react";
import { addRestaurantExpense } from "@/features/restaurant/actions/expenses";
import { getSalesContext, listAccessibleBranches } from "@/features/sales/server/context";
import { getBusinessDateISO } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/server";

export default async function RegistrarEgresoPage({
  searchParams,
}:{
  searchParams:Promise<{estado?:string}>;
}) {
  const context=await getSalesContext();
  if(!context)redirect("/configuracion");
  const {estado}=await searchParams;
  const supabase=await createClient();
  const branches=await listAccessibleBranches(context);
  const [categories,methods]=await Promise.all([
    supabase.from("restaurant_expense_categories").select("id,code,name")
      .eq("organization_id",context.organizationId).eq("active",true).order("name"),
    supabase.from("restaurant_payment_methods").select("id,name")
      .eq("organization_id",context.organizationId).eq("active",true).order("sort_order"),
  ]);
  const today=getBusinessDateISO(new Date(),context.timeZone);
  return <section className="mx-auto max-w-4xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Finanzas</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[#14201b] sm:text-3xl">
          <ReceiptText className="size-6 text-orange-600" aria-hidden="true"/> Registrar egreso
        </h1>
        <p className="mt-2 text-sm text-[#63746a]">
          Registra cualquier compra o gasto del restaurante, haya sido pagado o no.
          No se descuenta automáticamente del arqueo de caja.
        </p>
      </div>
      <Link href="/egresos" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-bold">Ver egresos</Link>
    </header>
    {estado==="guardado"?<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Egreso registrado correctamente.</p>:null}
    {estado==="adjunto"?<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
      El egreso fue registrado, pero no se pudo adjuntar el archivo. No vuelvas a registrar el gasto.
    </p>:null}
    {estado&&!["guardado","adjunto"].includes(estado)?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
      No se registró el egreso. Revisa los datos o verifica SQL 017 y 019.
    </p>:null}
    {categories.error||methods.error?<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se cargó la configuración financiera.</p>:null}
    {context.role!=="owner"?<p className="rounded-xl border bg-white p-4 text-sm">Solo el administrador puede registrar gastos.</p>:
      <form action={addRestaurantExpense} className="rounded-2xl border border-[#e8e3d7] bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c] sm:col-span-2">
            Descripción de la compra o gasto
            <input name="description" required minLength={3} maxLength={200}
              placeholder="Ej. Compra de carne, aceite y verduras"
              className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-orange-600"/>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c]">
            Importe total (S/)
            <input name="amount" required type="number" step="0.01" min="0.01" max="999999999.99" inputMode="decimal"
              className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-orange-600"/>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c]">
            Fecha del gasto
            <input name="expense_date" required type="date" defaultValue={today} max={today}
              className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-orange-600"/>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c]">
            Categoría
            <select name="category" required defaultValue="compras" className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 font-normal">
              {(categories.data??[]).map(c=><option key={c.id} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c]">
            Local
            <select name="branch_id" required defaultValue={branches[0]?.id??""} className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 font-normal">
              {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c]">
            Medio de pago (opcional)
            <select name="payment_method_id" defaultValue="" className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 font-normal">
              <option value="">No especificado</option>
              {(methods.data??[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-[#dad9d0] px-4 py-3 text-sm font-semibold text-[#35423c]">
            <input type="checkbox" name="credit" className="size-5 accent-orange-600"/>
            Compra a crédito / pendiente de pago
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c] sm:col-span-2">
            Notas (opcional)
            <textarea name="notes" rows={3} maxLength={1000} placeholder="Proveedor, observaciones..."
              className="rounded-xl border border-[#dad9d0] p-3 font-normal"/>
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[#35423c] sm:col-span-2">
            <span className="flex items-center gap-2"><Paperclip className="size-4" aria-hidden="true"/> Comprobante de compra (opcional)</span>
            <input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              className="min-h-11 rounded-xl border border-[#dad9d0] px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-2 file:py-1 file:text-orange-800"/>
            <span className="text-xs font-normal text-[#63746a]">Imagen o PDF privado; máximo 5 MB.</span>
          </label>
        </div>
        <button type="submit" disabled={!categories.data?.length||!branches.length}
          className="mt-5 min-h-12 rounded-xl bg-orange-600 px-6 text-sm font-extrabold text-white disabled:opacity-50">
          Guardar egreso
        </button>
        <p className="mt-3 text-xs leading-relaxed text-[#63746a]">
          El importe entra en el resultado del día indicado incluso si se pagará después.
          El pago de una deuda no volverá a contar como egreso.
        </p>
      </form>}
  </section>;
}
