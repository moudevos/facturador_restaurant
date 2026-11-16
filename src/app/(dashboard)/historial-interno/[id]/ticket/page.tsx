import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintTicketButton } from "@/features/restaurant/components/print-ticket-button";
import { getSalesContext } from "@/features/sales/server/context";
import { formatMoney } from "@/features/sales/utils/format";
import { createClient } from "@/lib/supabase/server";

type Item = {
  id:string;description:string;quantity:number|string;unit_price:number|string;
  line_total:number|string;discount_amount:number|string;addons:unknown;notes:string|null;
};
type Payment = { id:string;method_id:string;amount:number|string };
type Order = {
  id:string;created_at:string;business_date:string;
  gross_amount:number|string;discount_amount:number|string;
  total_amount:number|string;customer_id:string|null;
};
type Addon = {name:string;price:number|string};
function validAddons(data:unknown):Addon[] {
  if(!Array.isArray(data))return [];
  return data.filter((v):v is Addon=>typeof v==="object"&&v!==null&&
    "name" in v&&"price" in v&&typeof v.name==="string"&&
    (typeof v.price==="string"||typeof v.price==="number"));
}

export default async function TicketInternoPage({
  params,
}:{
  params:Promise<{id:string}>;
}) {
  const context=await getSalesContext();
  if(!context)redirect("/login");
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const supabase=await createClient();
  const [orderResult,itemsResult,paymentResult,preferencesResult]=await Promise.all([
    supabase.from("restaurant_orders")
      .select("id,created_at,business_date,gross_amount,discount_amount,total_amount,customer_id")
      .eq("id",id).eq("organization_id",context.organizationId).maybeSingle(),
    supabase.from("restaurant_order_items")
      .select("id,description,quantity,unit_price,line_total,discount_amount,addons,notes")
      .eq("order_id",id).eq("organization_id",context.organizationId),
    supabase.from("restaurant_order_payments")
      .select("id,method_id,amount")
      .eq("order_id",id).eq("organization_id",context.organizationId),
    supabase.from("restaurant_preferences")
      .select("receipt_width_mm")
      .eq("organization_id",context.organizationId).maybeSingle(),
  ]);
  if(!orderResult.data)notFound();
  const order=orderResult.data as Order;
  const items=(itemsResult.data??[]) as Item[];
  const payments=(paymentResult.data??[]) as Payment[];
  const {data:methodsResult}=await supabase.from("restaurant_payment_methods")
    .select("id,name").eq("organization_id",context.organizationId);
  const methods=new Map((methodsResult??[]).map(m=>[m.id,m.name]));
  const width=preferencesResult.data?.receipt_width_mm===58?58:80;
  const itemTotal=items.reduce((sum,i)=>sum+Number(i.line_total),0);
  const saleDiscount=Math.max(0,Math.round((itemTotal-Number(order.total_amount))*100)/100);
  const date=new Intl.DateTimeFormat("es-PE",{
    dateStyle:"short",timeStyle:"short",timeZone:context.timeZone,
  }).format(new Date(order.created_at));

  return <>
    <style>{"@media print { body * { visibility:hidden !important } #restaurant-print-ticket, #restaurant-print-ticket * { visibility:visible !important } #restaurant-print-ticket { display:block !important; position:fixed !important; top:0; left:0; padding:2mm !important; margin:0 !important; background:white !important; color:black !important; box-shadow:none !important; border:none !important; font-family:monospace !important } @page { margin:0 } }"}</style>
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14201b]">Reimprimir ticket interno</h1>
          <p className="mt-1 text-sm text-[#63746a]">Venta {order.id.slice(0,8).toUpperCase()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/historial-interno" className="inline-flex min-h-11 items-center rounded-xl border bg-white px-4 text-sm font-bold">Volver al historial</Link>
          <PrintTicketButton/>
        </div>
      </header>
      <div id="restaurant-print-ticket" className="mx-auto space-y-2 border border-[#e8e3d7] bg-white p-4 text-black shadow-sm"
        style={{width:width+"mm",maxWidth:"100%",fontFamily:"monospace"}}>
        <p className="text-center text-base font-black">{context.tradeName}</p>
        <p className="text-center text-sm font-black">TICKET INTERNO</p>
        <p className="text-center text-xs">Sin valor tributario</p>
        <p className="text-xs">{date}</p>
        <p className="text-xs">Venta: {order.id.slice(0,8).toUpperCase()}</p>
        <hr className="border-dashed"/>
        {items.map(item=><div key={item.id} className="space-y-0.5 text-xs">
          <p className="flex justify-between gap-2">
            <span>{Number(item.quantity)} × {item.description}</span>
            <strong className="shrink-0">{formatMoney(Number(item.line_total))}</strong>
          </p>
          {validAddons(item.addons).map((addon,index)=><p key={index} className="pl-2 text-[10px]">
            + {addon.name} ({formatMoney(Number(addon.price))})
          </p>)}
          {item.notes?<p className="pl-2 text-[10px]">{item.notes}</p>:null}
        </div>)}
        {saleDiscount>0?<p className="flex justify-between text-xs">
          <span>Descuento total</span><span>−{formatMoney(saleDiscount)}</span>
        </p>:null}
        <hr className="border-dashed"/>
        <p className="flex justify-between text-sm font-black">
          <span>TOTAL</span><span>{formatMoney(Number(order.total_amount))}</span>
        </p>
        {payments.map(p=><p key={p.id} className="flex justify-between text-xs">
          <span>{methods.get(p.method_id)??"Método de pago"}</span>
          <span>{formatMoney(Number(p.amount))}</span>
        </p>)}
        <p className="pt-3 text-center text-xs">Gracias por su compra</p>
      </div>
    </section>
  </>;
}
