import Link from "next/link";
import { redirect } from "next/navigation";
import { WalletCards } from "lucide-react";

import { addExpenseCreditPayment } from "@/features/restaurant/actions/expenses";
import { getSalesContext } from "@/features/sales/server/context";
import { formatMoney } from "@/features/sales/utils/format";
import { createClient } from "@/lib/supabase/server";

export default async function CuentasPorPagarPage({
  searchParams,
}:{
  searchParams:Promise<{estado?:string}>;
}) {
  const context=await getSalesContext();
  if(!context)redirect("/configuracion");
  const {estado}=await searchParams;
  const supabase=await createClient();
  const [debtsResult,methodsResult]=await Promise.all([
    supabase.from("v_restaurant_outstanding_expenses")
      .select("id,expense_date,description,original_amount,paid_amount,pending_amount")
      .eq("organization_id",context.organizationId)
      .order("expense_date",{ascending:false}).limit(150),
    supabase.from("restaurant_payment_methods")
      .select("id,name")
      .eq("organization_id",context.organizationId)
      .eq("active",true).order("sort_order"),
  ]);
  const debts=debtsResult.data??[];
  const pending=debts.reduce((sum,d)=>sum+Math.max(0,Number(d.pending_amount)),0);

  return <section className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Finanzas</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[#14201b] sm:text-3xl">
          <WalletCards className="size-6 text-orange-600" aria-hidden="true"/> Cuentas por pagar
        </h1>
        <p className="mt-2 text-sm text-[#63746a]">
          El gasto ya está en el resultado desde la fecha de compra.
          Los abonos reducen la deuda, no generan otro gasto.
        </p>
      </div>
      <Link href="/egresos/registro" className="inline-flex min-h-11 items-center rounded-xl bg-orange-600 px-4 text-sm font-bold text-white">
        Registrar compra
      </Link>
    </header>
    {estado==="guardado"?<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Abono registrado.</p>:null}
    {estado&&estado!=="guardado"?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">No se pudo registrar el abono. Comprueba el saldo y los permisos.</p>:null}
    {debtsResult.error||methodsResult.error?<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
      No se pudo cargar las deudas. Comprueba los SQL 017 y 019.
    </p>:null}
    <div className="rounded-2xl border border-[#e8e3d7] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[#63746a]">Saldo pendiente total</p>
      <p className="erp-mono mt-2 text-3xl font-extrabold text-[#14201b]">{formatMoney(pending)}</p>
      <p className="mt-1 text-xs text-[#63746a]">De las últimas {debts.length} compras a crédito mostradas.</p>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      {debts.map(d=><article key={d.id} className="space-y-3 rounded-2xl border border-[#e8e3d7] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[#63746a]">{d.expense_date}</p>
            <h2 className="mt-1 font-extrabold text-[#14201b]">{d.description}</h2>
            <p className="mt-2 text-xs text-[#63746a]">
              Original: {formatMoney(Number(d.original_amount))} · Abonado: {formatMoney(Number(d.paid_amount))}
            </p>
          </div>
          <p className={"erp-mono shrink-0 text-lg font-extrabold "+(Number(d.pending_amount)>0?"text-orange-700":"text-emerald-700")}>
            {formatMoney(Number(d.pending_amount))}
          </p>
        </div>
        {Number(d.pending_amount)>0&&context.role==="owner"?<form action={addExpenseCreditPayment}
          className="space-y-3 rounded-xl bg-[#f8f6f1] p-3">
          <input type="hidden" name="expense_id" value={d.id}/>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold text-[#53645a]">
              Abono S/
              <input name="amount" required type="number" min="0.01" max={Number(d.pending_amount).toFixed(2)} step="0.01"
                defaultValue={Number(d.pending_amount).toFixed(2)}
                className="min-h-11 rounded-lg border border-[#dad9d0] bg-white px-3 text-sm font-normal"/>
            </label>
            <label className="grid gap-1 text-xs font-bold text-[#53645a]">
              Medio de pago (opcional)
              <select name="payment_method_id" defaultValue="" className="min-h-11 rounded-lg border border-[#dad9d0] bg-white px-3 text-sm font-normal">
                <option value="">Sin especificar</option>
                {(methodsResult.data??[]).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-xs font-bold text-[#53645a]">
            Código de operación (opcional)
            <input name="reference" maxLength={120} placeholder="Operación o referencia"
              className="min-h-11 rounded-lg border border-[#dad9d0] bg-white px-3 text-sm font-normal"/>
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-[#14201b] px-4 text-sm font-bold text-white">Registrar abono</button>
        </form>:Number(d.pending_amount)<=0?<p className="text-sm font-bold text-emerald-700">Pagado por completo</p>:null}
      </article>)}
      {!debts.length?<p className="rounded-2xl border bg-white p-6 text-sm text-[#63746a]">Aún no hay cuentas por pagar.</p>:null}
    </div>
  </section>;
}
