"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSalesContext, listAccessibleBranches } from "@/features/sales/server/context";
import { getBusinessDateISO } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/server";

export async function addRestaurantExpense(formData:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/egresos/registro?estado=permiso");
  const branchId=String(formData.get("branch_id")??"");
  const date=String(formData.get("expense_date")??"");
  const category=String(formData.get("category")??"");
  const description=String(formData.get("description")??"").trim();
  const amountText=String(formData.get("amount")??"");
  const notes=String(formData.get("notes")??"").trim();
  const credit=formData.get("credit")==="on";
  const methodId=String(formData.get("payment_method_id")??"");
  const file=formData.get("attachment");

  const today=getBusinessDateISO(new Date(),context.timeZone);
  const branches=await listAccessibleBranches(context);
  if(!branches.some(b=>b.id===branchId)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today||
    description.length<3||description.length>200||notes.length>1000||
    !/^\d+(\.\d{1,2})?$/.test(amountText)||Number(amountText)<=0||
    Number(amountText)>999999999.99 ||
    !/^[a-z0-9_]{2,40}$/.test(category)) {
    redirect("/egresos/registro?estado=datos");
  }
  const supabase=await createClient();
  const {data:id,error}=await supabase.rpc("restaurant_create_expense",{
    p_branch_id:branchId,
    p_date:date,
    p_category_code:category,
    p_description:description,
    p_amount:Number(amountText),
    p_credit:credit,
    p_method_id:methodId||null,
    p_notes:notes||null,
  });
  if(error||typeof id!=="string")redirect("/egresos/registro?estado=error");

  let attachmentFailed=false;
  if(file instanceof File&&file.size>0) {
    const mime=file.type;
    const extension=(
      {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"} as Record<string,string>
    )[mime];
    if(!extension||file.size>5*1024*1024) {
      attachmentFailed=true;
    } else {
      const path=context.organizationId+"/"+id+"/"+crypto.randomUUID()+"."+extension;
      const {error:uploadError}=await supabase.storage.from("restaurant-expense-docs")
        .upload(path,file,{contentType:mime,upsert:false});
      if(uploadError) {
        attachmentFailed=true;
      } else {
        const {error:metadataError}=await supabase.from("restaurant_expense_attachments").insert({
          organization_id:context.organizationId,
          expense_id:id,
          storage_path:path,
          file_name:file.name.slice(0,200)||"Adjunto",
          mime_type:mime,
          created_by:context.userId,
        });
        if(metadataError)attachmentFailed=true;
      }
    }
  }
  revalidatePath("/egresos");
  revalidatePath("/egresos/deudas");
  revalidatePath("/resultado");
  redirect(attachmentFailed?"/egresos/registro?estado=adjunto":"/egresos/registro?estado=guardado");
}

export async function addExpenseCreditPayment(formData:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/egresos/deudas?estado=permiso");
  const expenseId=String(formData.get("expense_id")??"");
  const methodId=String(formData.get("payment_method_id")??"");
  const amountText=String(formData.get("amount")??"");
  const reference=String(formData.get("reference")??"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(expenseId)||(methodId&&!/^[0-9a-f-]{36}$/i.test(methodId))||
     !/^\d+(\.\d{1,2})?$/.test(amountText)||Number(amountText)<=0||reference.length>120) {
    redirect("/egresos/deudas?estado=datos");
  }
  const supabase=await createClient();
  const {error}=await supabase.rpc("restaurant_pay_expense",{
    p_expense_id:expenseId,
    p_amount:Number(amountText),
    p_method_id:methodId||null,
    p_reference:reference||null,
  });
  if(error)redirect("/egresos/deudas?estado=error");
  revalidatePath("/egresos/deudas");
  redirect("/egresos/deudas?estado=guardado");
}
