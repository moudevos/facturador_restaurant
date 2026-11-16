"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

const uuid=(s:string)=>/^[0-9a-f-]{36}$/i.test(s);
const done=()=>{
  revalidatePath("/combos");
  revalidatePath("/pos-rapido");
  redirect("/combos?estado=guardado");
};

export async function addComboComponent(form:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/combos?estado=permiso");
  const combo=String(form.get("combo")??"");
  const component=String(form.get("component")??"");
  const quantity=String(form.get("quantity")??"");
  const mode=String(form.get("mode")??"");
  if(!uuid(combo)||!uuid(component)||combo===component||
     !/^\d+(\.\d{1,3})?$/.test(quantity)||Number(quantity)<=0||
     Number(quantity)>100||!["sum","fixed"].includes(mode)) {
    redirect("/combos?estado=datos");
  }
  const supabase=await createClient();
  const {data:validProducts}=await supabase.from("products").select("id")
    .eq("organization_id",context.organizationId).in("id",[combo,component]);
  if(validProducts?.length!==2)redirect("/combos?estado=datos");
  const {error}=await supabase.from("restaurant_combo_components").insert({
    organization_id:context.organizationId,
    combo_product_id:combo,
    component_product_id:component,
    quantity:Number(quantity),
    price_mode:mode,
  });
  if(error)redirect("/combos?estado=error");
  done();
}

export async function changeComboMode(form:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/combos?estado=permiso");
  const combo=String(form.get("combo")??"");
  const mode=String(form.get("mode")??"");
  if(!uuid(combo)||!["sum","fixed"].includes(mode))redirect("/combos?estado=datos");
  const supabase=await createClient();
  const {error}=await supabase.from("restaurant_combo_components")
    .update({price_mode:mode})
    .eq("organization_id",context.organizationId)
    .eq("combo_product_id",combo);
  if(error)redirect("/combos?estado=error");
  done();
}

export async function removeComboComponent(form:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/combos?estado=permiso");
  const id=String(form.get("id")??"");
  if(!uuid(id))redirect("/combos?estado=datos");
  const supabase=await createClient();
  const {error}=await supabase.from("restaurant_combo_components")
    .delete().eq("id",id).eq("organization_id",context.organizationId);
  if(error)redirect("/combos?estado=error");
  done();
}

export async function addProductAddon(form:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/combos?estado=permiso");
  const productId=String(form.get("product")??"");
  const name=String(form.get("name")??"").trim();
  const price=String(form.get("price")??"");
  if(!uuid(productId)||name.length<2||name.length>100||
     !/^\d+(\.\d{1,2})?$/.test(price)||Number(price)>99999999) {
    redirect("/combos?estado=datos");
  }
  const supabase=await createClient();
  const {data:product}=await supabase.from("products").select("id")
    .eq("id",productId).eq("organization_id",context.organizationId).maybeSingle();
  if(!product)redirect("/combos?estado=datos");
  const {error}=await supabase.from("restaurant_product_addons").insert({
    organization_id:context.organizationId,product_id:productId,
    name,extra_price:Number(price),
  });
  if(error)redirect("/combos?estado=error");
  done();
}

export async function updateProductAddon(form:FormData) {
  const context=await getSalesContext();
  if(!context||context.role!=="owner")redirect("/combos?estado=permiso");
  const id=String(form.get("id")??"");
  const name=String(form.get("name")??"").trim();
  const price=String(form.get("price")??"");
  const active=form.get("active")==="on";
  if(!uuid(id)||name.length<2||name.length>100||
     !/^\d+(\.\d{1,2})?$/.test(price)||Number(price)>99999999) {
    redirect("/combos?estado=datos");
  }
  const supabase=await createClient();
  const {error}=await supabase.from("restaurant_product_addons")
    .update({name,extra_price:Number(price),active})
    .eq("id",id).eq("organization_id",context.organizationId);
  if(error)redirect("/combos?estado=error");
  done();
}
