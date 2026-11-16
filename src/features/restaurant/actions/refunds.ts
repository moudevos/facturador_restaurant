"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

function isUuid(value:string) {
  return /^[0-9a-f-]{36}$/i.test(value);
}

export async function reverseInternalSale(formData:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/historial-interno?estado=permiso");
  const orderId=String(formData.get("order_id")??"");
  const reason=String(formData.get("reason")??"").trim();
  if(!isUuid(orderId)||reason.length<3||reason.length>300) {
    redirect("/historial-interno?estado=datos");
  }
  const supabase=await createClient();
  const {error}=await supabase.rpc("restaurant_reverse_order",{
    p_order_id:orderId,p_reason:reason,
  });
  if(error)redirect("/historial-interno?estado=error");
  revalidatePath("/historial-interno");
  revalidatePath("/resultado");
  redirect("/historial-interno?estado=anulada");
}

export async function refundInternalSale(formData:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/historial-interno?estado=permiso");
  const reversalId=String(formData.get("reversal_id")??"");
  const methodId=String(formData.get("method_id")??"");
  const sessionId=String(formData.get("session_id")??"");
  const amountText=String(formData.get("amount")??"");
  const reference=String(formData.get("reference")??"").trim();
  if(!isUuid(reversalId)||!isUuid(methodId)||(sessionId&&!isUuid(sessionId))||
     !/^\d+(\.\d{1,2})?$/.test(amountText)||Number(amountText)<=0||
     reference.length>120) {
    redirect("/historial-interno?estado=datos");
  }
  const supabase=await createClient();
  const {error}=await supabase.rpc("restaurant_refund_order",{
    p_reversal_id:reversalId,
    p_method_id:methodId,
    p_amount:Number(amountText),
    p_session_id:sessionId||null,
    p_reference:reference||null,
  });
  if(error)redirect("/historial-interno?estado=error");
  revalidatePath("/historial-interno");
  revalidatePath("/ventas");
  redirect("/historial-interno?estado=devuelta");
}
