"use server";

import { createClient } from "@/lib/supabase/server";
import { productFormSchema } from "../schemas/product-schema";
import { getProductContext } from "./products";

export type ProductActionResult = { success: boolean; message: string };

function toFormValues(formData: FormData) {
  return {
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    sku: formData.get("sku"),
    sunatProductCode: formData.get("sunatProductCode"),
    description: formData.get("description"),
    price: formData.get("price"),
    unitCode: formData.get("unitCode"),
    taxAffectationCode: formData.get("taxAffectationCode"),
    active: formData.get("active") === "true",
  };
}

function databaseMessage(error: { code?: string; message?: string } | null): ProductActionResult {
  if (error?.code === "23505") {
    return { success: false, message: "Ya existe un producto con ese SKU o código." };
  }
  if (error?.code === "23503") {
    return { success: false, message: "La categoría seleccionada no es válida." };
  }
  if (error?.message?.includes("product_code")) {
    return { success: false, message: "Falta aplicar SQL 012 del catálogo de productos." };
  }
  return { success: false, message: "No pudimos guardar el producto. Intenta nuevamente." };
}

async function requireOwner() {
  const context = await getProductContext();
  return context?.role === "owner" ? context : null;
}

export async function createProductAction(
  formData: FormData,
): Promise<ProductActionResult> {
  const context = await requireOwner();
  if (!context) {
    return { success: false, message: "No tienes permiso para crear productos." };
  }

  const parsed = productFormSchema.safeParse(toFormValues(formData));
  if (!parsed.success) {
    return { success: false, message: "Revisa los campos marcados e intenta nuevamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    organization_id: context.organizationId,
    created_by: context.userId,
    name: parsed.data.name,
    category_id: parsed.data.categoryId,
    sku: parsed.data.sku,
    sunat_product_code: parsed.data.sunatProductCode,
    description: parsed.data.description,
    price: parsed.data.price,
    unit_code: parsed.data.unitCode,
    tax_affectation_code: parsed.data.taxAffectationCode,
    active: true,
  });

  if (error) return databaseMessage(error);
  return { success: true, message: "Producto creado correctamente." };
}

export async function updateProductAction(
  id: string,
  formData: FormData,
): Promise<ProductActionResult> {
  const context = await requireOwner();
  if (!context) {
    return { success: false, message: "No tienes permiso para editar productos." };
  }

  const parsed = productFormSchema.safeParse(toFormValues(formData));
  if (!parsed.success) {
    return { success: false, message: "Revisa los campos marcados e intenta nuevamente." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.categoryId,
      sku: parsed.data.sku,
      sunat_product_code: parsed.data.sunatProductCode,
      description: parsed.data.description,
      price: parsed.data.price,
      unit_code: parsed.data.unitCode,
      tax_affectation_code: parsed.data.taxAffectationCode,
      active: parsed.data.active,
    })
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .select("id")
    .maybeSingle();

  if (error) return databaseMessage(error);
  if (!data) return { success: false, message: "Producto no encontrado." };
  return { success: true, message: "Producto actualizado correctamente." };
}

export async function setProductActiveAction(
  id: string,
  active: boolean,
): Promise<ProductActionResult> {
  const context = await requireOwner();
  if (!context) {
    return { success: false, message: "No tienes permiso para cambiar el estado." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .select("id")
    .maybeSingle();

  if (error) return databaseMessage(error);
  if (!data) return { success: false, message: "Producto no encontrado." };

  return {
    success: true,
    message: active ? "Producto activado." : "Producto desactivado.",
  };
}
