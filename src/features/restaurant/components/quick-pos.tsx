"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { checkoutInternalSale, type CheckoutRequest } from "@/features/restaurant/actions/checkout";
import { formatMoney } from "@/features/sales/utils/format";

type Product = { id:string; name:string; category_id:string|null; sale_price:number|string };
type Category = { id:string; name:string };
type Addon = { id:string; product_id:string; name:string; extra_price:number|string };
type Rule = { id:string; name:string; mode:string; scope:string; value:number|string; max_amount:number|string|null };
type Method = { id:string; name:string; kind:string };
type Customer = { id:string; name:string; document_number:string };
type Line = { key:string; productId:string; quantity:number; addonIds:string[]; discountRuleId:string|null; notes:string };
type Pay = { amount:string; reference:string };
type Receipt = { id:string; date:string; lines:{name:string;qty:number;total:number;notes:string}[]; payments:{name:string;amount:number}[]; total:number };

const c = (n:number|string) => Math.round(Number(n)*100);
const display = (n:number) => formatMoney(n/100);
const amountOk = (s:string) => /^\d+(\.\d{1,2})?$/.test(s);

export function QuickPos({
  sessionId,products,categories,addons,discounts,methods,customers,receiptWidth,canCheckout,
}:{
  sessionId:string; products:Product[]; categories:Category[]; addons:Addon[];
  discounts:Rule[]; methods:Method[]; customers:Customer[];
  receiptWidth:58|80; canCheckout:boolean;
}) {
  const [search,setSearch]=useState("");
  const [category,setCategory]=useState("");
  const [cart,setCart]=useState<Line[]>([]);
  const [saleRule,setSaleRule]=useState("");
  const [customer,setCustomer]=useState("");
  const [payments,setPayments]=useState<Record<string,Pay>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [receipt,setReceipt]=useState<Receipt|null>(null);
  const token=useRef("");

  const productMap=new Map(products.map(p=>[p.id,p]));
  const addonMap=new Map(addons.map(a=>[a.id,a]));
  const ruleMap=new Map(discounts.map(r=>[r.id,r]));
  const visible=products.filter(p=>(!category||p.category_id===category)&&p.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));

  function discount(rule:Rule|undefined,base:number) {
    if(!rule) return 0;
    const value=rule.mode==="percent"?Math.round(base*Number(rule.value)/100):c(rule.value);
    return Math.max(0,Math.min(base,value,rule.max_amount===null?base:c(rule.max_amount)));
  }
  function lineAmount(line:Line) {
    const p=productMap.get(line.productId);
    if(!p) return 0;
    const unit=c(p.sale_price)+line.addonIds.reduce((sum,id)=>sum+c(addonMap.get(id)?.extra_price??0),0);
    const gross=unit*line.quantity;
    return gross-discount(ruleMap.get(line.discountRuleId??""),gross);
  }
  const subtotal=cart.reduce((sum,line)=>sum+lineAmount(line),0);
  const total=subtotal-discount(ruleMap.get(saleRule),subtotal);
  const paid=Object.values(payments).reduce((sum,p)=>sum+(amountOk(p.amount)?c(p.amount):0),0);
  const remaining=total-paid;

  function patchLine(key:string,updates:Partial<Line>) {
    setCart(current=>current.map(l=>l.key===key?{...l,...updates}:l));
  }
  function patchPay(id:string,updates:Partial<Pay>) {
    setPayments(current=>({...current,[id]:{amount:current[id]?.amount??"",reference:current[id]?.reference??"",...updates}}));
  }
  function fillBalance(id:string) {
    const other=Object.entries(payments).reduce((sum,[key,p])=>sum+(key!==id&&amountOk(p.amount)?c(p.amount):0),0);
    patchPay(id,{amount:(Math.max(0,total-other)/100).toFixed(2)});
  }

  async function checkout() {
    if(busy||!cart.length||total<=0||!canCheckout) return;
    setError("");
    if(remaining!==0 || Object.values(payments).some(p=>p.amount.trim()!==""&&!amountOk(p.amount))) {
      setError("Los pagos deben sumar exactamente el total.");return;
    }
    const payEntries=methods.flatMap(m=>{
      const p=payments[m.id];
      return p?.amount&&amountOk(p.amount)&&c(p.amount)>0
        ? [{methodId:m.id,amount:c(p.amount)/100,reference:p.reference.trim()}] : [];
    });
    if(!payEntries.length){setError("Selecciona un método de pago.");return;}
    if(!token.current)token.current=crypto.randomUUID();
    const request:CheckoutRequest={
      sessionId,token:token.current,
      items:cart.map(l=>({productId:l.productId,quantity:l.quantity,addonIds:l.addonIds,
        discountRuleId:l.discountRuleId,notes:l.notes})),
      payments:payEntries,saleDiscountRuleId:saleRule||null,customerId:customer||null,
    };
    setBusy(true);
    try {
      const result=await checkoutInternalSale(request);
      if(!result.ok){setError(result.message);return;}
      setReceipt({
        id:result.orderId,
        date:new Intl.DateTimeFormat("es-PE",{dateStyle:"short",timeStyle:"short",timeZone:"America/Lima"}).format(new Date()),
        lines:cart.map(l=>({name:productMap.get(l.productId)?.name??"Producto",qty:l.quantity,
          total:lineAmount(l),notes:[...l.addonIds.map(id=>addonMap.get(id)?.name??""),l.notes].filter(Boolean).join(", ")})),
        payments:payEntries.map(p=>({name:methods.find(m=>m.id===p.methodId)?.name??"Otro",amount:c(p.amount)})),
        total,
      });
      setCart([]);setPayments({});setSaleRule("");setCustomer("");token.current="";
    } catch {
      setError("No se confirmó la venta. Consulta el historial antes de reintentar.");
    } finally {setBusy(false);}
  }

  return <>
    <style>{"@media print { body * { visibility:hidden !important } #restaurant-print-ticket, #restaurant-print-ticket * { visibility:visible !important } #restaurant-print-ticket { display:block !important; position:absolute !important; inset:0 auto auto 0; background:white !important; color:black !important; margin:0 !important; padding:2mm !important; font-family:monospace !important } @page { margin:0 } }"}</style>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Restaurante · Cobro inmediato</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#14201b] sm:text-3xl">POS · Venta rápida</h1>
        <p className="mt-1 text-sm text-[#63746a]">Venta interna, sin emisión automática de comprobante electrónico.</p>
      </div>
      <div className="rounded-2xl bg-[#14201b] px-5 py-3 text-right text-white">
        <p className="text-xs text-white/70">Total a cobrar</p>
        <p className="erp-mono text-2xl font-bold text-orange-400">{display(total)}</p>
      </div>
    </header>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
      <section className="min-w-0 space-y-4">
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#dad9d0] bg-white px-3 focus-within:outline-2 focus-within:outline-orange-600">
          <Search aria-hidden="true" className="size-4 text-[#63746a]"/>
          <span className="sr-only">Buscar productos</span>
          <input type="search" placeholder="Buscar productos..." value={search}
            onChange={e=>setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/>
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Categorías">
          <button type="button" aria-pressed={!category} onClick={()=>setCategory("")}
            className={"shrink-0 rounded-full px-4 py-2 text-xs font-bold "+(!category?"bg-[#14201b] text-white":"border bg-white")}>Todos</button>
          {categories.map(item=><button type="button" key={item.id} aria-pressed={category===item.id}
            onClick={()=>setCategory(item.id)}
            className={"shrink-0 rounded-full px-4 py-2 text-xs font-bold "+(category===item.id?"bg-[#14201b] text-white":"border bg-white")}>{item.name}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map(p=><button type="button" key={p.id}
            onClick={()=>{setCart(old=>[...old,{key:crypto.randomUUID(),productId:p.id,quantity:1,addonIds:[],discountRuleId:null,notes:""}]);setError("");}}
            className="flex min-h-[126px] flex-col items-start justify-between gap-2 rounded-2xl border border-[#e8e3d7] bg-white p-4 text-left shadow-sm hover:border-orange-500 focus-visible:outline-2 focus-visible:outline-orange-600">
            <span className="line-clamp-3 text-sm font-extrabold text-[#14201b]">{p.name}</span>
            <span className="flex w-full items-center justify-between text-sm font-extrabold text-orange-700">
              {formatMoney(Number(p.sale_price))}<Plus className="size-5" aria-hidden="true"/>
            </span>
          </button>)}
          {!visible.length?<p className="col-span-full p-5 text-sm text-[#63746a]">Sin productos.</p>:null}
        </div>
      </section>

      <aside className="space-y-4 rounded-2xl border border-[#e8e3d7] bg-white p-4 shadow-sm" aria-label="Carrito y pagos">
        <h2 className="text-lg font-extrabold text-[#14201b]">Venta actual · {cart.length} líneas</h2>
        {cart.length===0?<p className="rounded-xl bg-[#f8f6f1] p-4 text-center text-sm text-[#63746a]">Selecciona un producto para comenzar.</p>:null}
        <div className="max-h-[430px] space-y-3 overflow-y-auto">
          {cart.map(l=>{
            const product=productMap.get(l.productId);
            const options=addons.filter(a=>a.product_id===l.productId);
            const lineRules=discounts.filter(d=>d.scope==="line"||d.scope==="both");
            return <article key={l.key} className="rounded-xl border border-[#e8e3d7] p-3">
              <div className="flex items-start justify-between gap-2">
                <strong className="text-sm text-[#14201b]">{product?.name}</strong>
                <button type="button" aria-label="Quitar producto"
                  onClick={()=>setCart(old=>old.filter(item=>item.key!==l.key))}
                  className="flex size-9 items-center justify-center text-rose-600"><Trash2 className="size-4"/></button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center rounded-lg border">
                  <button type="button" aria-label="Restar cantidad" className="flex size-9 items-center justify-center"
                    onClick={()=>l.quantity===1?setCart(old=>old.filter(x=>x.key!==l.key)):patchLine(l.key,{quantity:l.quantity-1})}><Minus className="size-4"/></button>
                  <span className="px-2 text-sm font-bold">{l.quantity}</span>
                  <button type="button" aria-label="Sumar cantidad" disabled={l.quantity>=100} className="flex size-9 items-center justify-center disabled:opacity-30"
                    onClick={()=>patchLine(l.key,{quantity:l.quantity+1})}><Plus className="size-4"/></button>
                </div>
                <strong className="erp-mono text-sm">{display(lineAmount(l))}</strong>
              </div>
              {(options.length>0||lineRules.length>0)?<details className="mt-3 text-xs">
                <summary className="cursor-pointer font-bold text-orange-700">Adicionales y descuentos</summary>
                {options.map(a=><label key={a.id} className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-orange-600"
                    checked={l.addonIds.includes(a.id)} onChange={e=>patchLine(l.key,{addonIds:e.target.checked?[...l.addonIds,a.id]:l.addonIds.filter(id=>id!==a.id)})}/>{a.name}</span>
                  {formatMoney(Number(a.extra_price))}
                </label>)}
                {lineRules.length>0?<label className="mt-3 grid gap-1 font-bold">Descuento de producto
                  <select value={l.discountRuleId??""} onChange={e=>patchLine(l.key,{discountRuleId:e.target.value||null})}
                    className="min-h-10 rounded-lg border bg-white px-2 font-normal"><option value="">Sin descuento</option>
                    {lineRules.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
                </label>:null}
              </details>:null}
              <label className="mt-3 grid gap-1 text-xs font-bold text-[#53645a]">Personalización (opcional)
                <input value={l.notes} maxLength={200} placeholder="Ej. Sin cebolla"
                  onChange={e=>patchLine(l.key,{notes:e.target.value})} className="min-h-10 rounded-lg border px-2 font-normal"/>
              </label>
            </article>;
          })}
        </div>

        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Descuento al total
          <select value={saleRule} onChange={e=>setSaleRule(e.target.value)} className="min-h-11 rounded-xl border bg-white px-3 font-normal">
            <option value="">Sin descuento</option>
            {discounts.filter(d=>d.scope==="sale"||d.scope==="both").map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-[#53645a]">Cliente (opcional)
          <select value={customer} onChange={e=>setCustomer(e.target.value)} className="min-h-11 rounded-xl border bg-white px-3 font-normal">
            <option value="">Cliente varios</option>
            {customers.map(cu=><option key={cu.id} value={cu.id}>{cu.name} · {cu.document_number}</option>)}
          </select>
        </label>
        <div className="space-y-1 rounded-xl bg-[#f8f6f1] p-4 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>{display(subtotal)}</span></p>
          <p className="flex justify-between"><span>Descuento de venta</span><span>−{display(discount(ruleMap.get(saleRule),subtotal))}</span></p>
          <p className="flex justify-between border-t pt-2 font-extrabold"><span>Total</span><span>{display(total)}</span></p>
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-extrabold text-[#14201b]">Pagos combinados</legend>
          {methods.map(m=><div key={m.id} className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">{m.name}</strong>
              <button type="button" onClick={()=>fillBalance(m.id)} className="min-h-9 rounded-lg border px-3 text-xs font-bold">Completar saldo</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs">Importe S/
                <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00"
                  value={payments[m.id]?.amount??""} onChange={e=>patchPay(m.id,{amount:e.target.value})}
                  className="min-h-10 min-w-0 rounded-lg border px-2 text-sm"/>
              </label>
              <label className="grid gap-1 text-xs">Código (opcional)
                <input maxLength={120} placeholder="Operación"
                  value={payments[m.id]?.reference??""} onChange={e=>patchPay(m.id,{reference:e.target.value})}
                  className="min-h-10 min-w-0 rounded-lg border px-2 text-sm"/>
              </label>
            </div>
          </div>)}
        </fieldset>
        <p role="status" className={"text-sm font-bold "+(remaining===0?"text-emerald-700":"text-orange-700")}>
          {remaining>0?"Pendiente: "+display(remaining):remaining<0?"Exceso: "+display(-remaining):"Pago completo"}
        </p>
        {error?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>:null}
        <button type="button" disabled={!canCheckout||busy||total<=0||remaining!==0} onClick={checkout}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 font-extrabold text-white disabled:opacity-50">
          <CheckCircle2 className="size-5" aria-hidden="true"/>{busy?"Registrando...":"Cobrar y guardar venta"}
        </button>
        <p className="text-center text-xs text-[#63746a]">Ticket interno sin valor tributario.</p>
      </aside>
    </div>

    {receipt?<section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-extrabold text-emerald-800">Venta registrada</h2>
          <p className="text-xs text-emerald-900">Ticket {receipt.id.slice(0,8).toUpperCase()}</p></div>
        <button type="button" onClick={()=>window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14201b] px-4 text-sm font-bold text-white">
          <Printer className="size-4" aria-hidden="true"/> Imprimir {receiptWidth} mm
        </button>
      </div>
      <div id="restaurant-print-ticket" className="mt-4 bg-white p-4 text-black"
        style={{width:receiptWidth+"mm",maxWidth:"100%",fontFamily:"monospace"}}>
        <p className="text-center text-base font-black">TICKET INTERNO</p>
        <p className="text-center text-xs">Sin valor tributario</p>
        <p className="mt-2 text-xs">{receipt.date}</p>
        <p className="text-xs">Venta {receipt.id.slice(0,8).toUpperCase()}</p>
        <hr className="my-2 border-dashed"/>
        {receipt.lines.map((l,i)=><div key={i} className="mb-2 text-xs">
          <p className="flex justify-between gap-2"><span>{l.qty} × {l.name}</span><span>{display(l.total)}</span></p>
          {l.notes?<p className="text-[10px]">{l.notes}</p>:null}
        </div>)}
        <hr className="my-2 border-dashed"/>
        <p className="flex justify-between text-sm font-black"><span>TOTAL</span><span>{display(receipt.total)}</span></p>
        {receipt.payments.map((p,i)=><p key={i} className="flex justify-between text-xs"><span>{p.name}</span><span>{display(p.amount)}</span></p>)}
        <p className="mt-3 text-center text-xs">Gracias por su compra</p>
      </div>
    </section>:null}
  </>;
}
