import Link from "next/link";
import { redirect } from "next/navigation";
import { History, ReceiptText, RotateCcw } from "lucide-react";

import { refundInternalSale, reverseInternalSale } from "@/features/restaurant/actions/refunds";
import { getSalesContext } from "@/features/sales/server/context";
import { formatMoney } from "@/features/sales/utils/format";
import { createClient } from "@/lib/supabase/server";

type Order = {
  id:string; branch_id:string; business_date:string; created_at:string;
  total_amount:number|string; discount_amount:number|string; fiscal_sale_id:string|null;
};
type Reversal = { id:string;order_id:string;business_date:string;amount:number|string;reason:string };
type Refund = { id:string;reversal_id:string;amount:number|string;created_at:string };
type OrderItem = { id:string;order_id:string;description:string;quantity:number|string;line_total:number|string;notes:string|null };

export default async function HistorialInterno({
  searchParams,
}:{
  searchParams:Promise<{estado?:string}>;
}) {
  const context=await getSalesContext();
  if(!context)redirect("/configuracion");
  const {estado}=await searchParams;
  const supabase=await createClient();
  const [ordersResult,methodsResult,openResult]=await Promise.all([
    supabase.from("restaurant_orders")
      .select("id,branch_id,business_date,created_at,total_amount,discount_amount,fiscal_sale_id")
      .eq("organization_id",context.organizationId)
      .order("created_at",{ascending:false}).limit(60),
    supabase.from("restaurant_payment_methods")
      .select("id,name,kind")
      .eq("organization_id",context.organizationId)
      .eq("active",true).order("sort_order"),
    supabase.from("v_sales_session_summary")
      .select("session_id,branch_id")
      .eq("organization_id",context.organizationId)
      .eq("status","open"),
  ]);
  const orders=(ordersResult.data??[]) as Order[];
  const ids=orders.map(o=>o.id);
  const [reversalResult,itemResult]=ids.length?await Promise.all([
    supabase.from("restaurant_order_reversals")
      .select("id,order_id,business_date,amount,reason").in("order_id",ids),
    supabase.from("restaurant_order_items")
      .select("id,order_id,description,quantity,line_total,notes")
      .in("order_id",ids),
  ]):[{data:[],error:null},{data:[],error:null}];
  const reversals=(reversalResult.data??[]) as Reversal[];
  const refundsResult=reversals.length?await supabase.from("restaurant_order_refunds")
    .select("id,reversal_id,amount,created_at")
    .in("reversal_id",reversals.map(r=>r.id)):{data:[],error:null};
  const refunds=(refundsResult.data??[]) as Refund[];
  const items=(itemResult.data??[]) as OrderItem[];
  const hasError=[ordersResult,methodsResult,openResult,reversalResult,itemResult,refundsResult].some(r=>r.error);
  const methods=methodsResult.data??[];
  const sessions=openResult.data??[];

  return <section className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Operación</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[#14201b] sm:text-3xl">
          <History className="size-6 text-orange-600" aria-hidden="true"/> Historial de ventas internas
        </h1>
        <p className="mt-2 text-sm text-[#63746a]">
          Las anulaciones generan un ajuste del día actual; ningún cierre anterior se modifica.
          La devolución física de dinero es una operación separada.
        </p>
      </div>
      <Link href="/pos-rapido" className="inline-flex min-h-11 items-center rounded-xl bg-orange-600 px-5 text-sm font-bold text-white">
        Nueva venta
      </Link>
    </header>
    {estado==="anulada"||estado==="devuelta"?<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
      {estado==="anulada"?"Anulación registrada; si corresponde, registra ahora la devolución.":"Devolución registrada."}
    </p>:null}
    {estado&&!["anulada","devuelta"].includes(estado)?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
      No se completó la operación. Revisa saldos, caja abierta y estado fiscal.
    </p>:null}
    {hasError?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      No se pudo cargar el historial completo. Comprueba SQL 018.
    </p>:null}

    <div className="space-y-4">
      {orders.map(order=>{
        const reversal=reversals.find(r=>r.order_id===order.id);
        const orderItems=items.filter(i=>i.order_id===order.id);
        const refunded=reversal?refunds.filter(r=>r.reversal_id===reversal.id)
          .reduce((sum,r)=>sum+Number(r.amount),0):0;
        const pending=reversal?Number(reversal.amount)-refunded:0;
        const possibleSessions=sessions.filter(s=>s.branch_id===order.branch_id);
        return <article key={order.id} className="overflow-hidden rounded-2xl border border-[#e8e3d7] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee9df] p-4 sm:p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#63746a]">{order.business_date}</p>
              <h2 className="mt-1 text-base font-extrabold text-[#14201b]">
                Venta {order.id.slice(0,8).toUpperCase()}
              </h2>
              <p className="mt-1 text-xs text-[#63746a]">
                {reversal?"Anulada con reversión "+reversal.business_date:"Venta registrada"}
              </p>
              <Link href={"/historial-interno/"+order.id+"/ticket"}
                className="mt-2 inline-flex min-h-9 items-center text-xs font-bold text-orange-700 underline underline-offset-4">
                Ver / reimprimir ticket
              </Link>
            </div>
            <div className="text-right">
              <strong className="erp-mono block text-lg text-[#14201b]">{formatMoney(Number(order.total_amount))}</strong>
              <span className={"text-xs font-bold "+(reversal?"text-rose-700":"text-emerald-700")}>
                {reversal?"Anulada":"Completada"}
              </span>
            </div>
          </div>
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#14201b]">
                <ReceiptText className="size-4" aria-hidden="true"/> Detalle
              </h3>
              {orderItems.map(item=><div key={item.id} className="flex justify-between gap-3 border-b border-[#eee9df] py-2 text-sm">
                <div><span>{Number(item.quantity)} × {item.description}</span>
                  {item.notes?<p className="text-xs text-[#63746a]">{item.notes}</p>:null}
                </div>
                <strong className="shrink-0 tabular-nums">{formatMoney(Number(item.line_total))}</strong>
              </div>)}
              <p className="text-xs text-[#63746a]">
                Descuento total: {formatMoney(Number(order.discount_amount))}
              </p>
            </div>

            <div className="space-y-3">
              {reversal?<div className="rounded-xl bg-[#f8f6f1] p-4">
                <p className="text-sm font-bold text-[#14201b]">Anulación: {reversal.reason}</p>
                <p className="mt-1 text-sm">Devoluciones: {formatMoney(refunded)} · Pendiente: {formatMoney(pending)}</p>
              </div>:null}

              {!reversal&&context.role==="owner"?<form action={reverseInternalSale} className="space-y-2 rounded-xl border border-[#e8e3d7] p-3">
                <input type="hidden" name="order_id" value={order.id}/>
                <label className="grid gap-1 text-xs font-bold text-[#53645a]">
                  Motivo de anulación
                  <input name="reason" minLength={3} maxLength={300} required
                    placeholder="Motivo de anulación"
                    className="min-h-11 rounded-lg border px-3 text-sm font-normal"/>
                </label>
                {order.fiscal_sale_id?<p className="text-xs text-rose-700">Requiere regularización fiscal previa.</p>:null}
                <button type="submit" disabled={Boolean(order.fiscal_sale_id)}
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-bold text-rose-700 disabled:opacity-50">
                  <RotateCcw className="size-4" aria-hidden="true"/> Anular venta
                </button>
              </form>:null}

              {reversal&&pending>0&&context.role==="owner"?<form action={refundInternalSale}
                className="space-y-3 rounded-xl border border-[#e8e3d7] p-3">
                <h3 className="text-sm font-extrabold text-[#14201b]">Registrar devolución</h3>
                <input type="hidden" name="reversal_id" value={reversal.id}/>
                <label className="grid gap-1 text-xs font-bold text-[#53645a]">Importe S/
                  <input required name="amount" type="number" min="0.01" max={pending.toFixed(2)} step="0.01"
                    defaultValue={pending.toFixed(2)}
                    className="min-h-11 rounded-lg border px-3 text-sm font-normal"/>
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#53645a]">Medio de devolución
                  <select required name="method_id" className="min-h-11 rounded-lg border bg-white px-3 text-sm font-normal">
                    {methods.map(method=><option value={method.id} key={method.id}>
                      {method.name}{method.kind==="cash"?" (requiere caja abierta)":""}
                    </option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#53645a]">Caja actual (para devoluciones en efectivo)
                  <select name="session_id" className="min-h-11 rounded-lg border bg-white px-3 text-sm font-normal">
                    <option value="">No corresponde / medio digital</option>
                    {possibleSessions.map(s=><option key={s.session_id} value={s.session_id}>Caja {s.session_id.slice(0,8)}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#53645a]">Código de operación (opcional)
                  <input name="reference" maxLength={120} className="min-h-11 rounded-lg border px-3 text-sm font-normal"/>
                </label>
                <button type="submit" className="min-h-11 rounded-lg bg-[#14201b] px-4 text-sm font-bold text-white">
                  Registrar devolución
                </button>
              </form>:null}
            </div>
          </div>
        </article>;
      })}
      {!orders.length?<p className="rounded-2xl border border-[#e8e3d7] bg-white p-7 text-center text-sm text-[#63746a]">
        Aún no hay ventas internas registradas.
      </p>:null}
    </div>
  </section>;
}
