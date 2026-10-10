"use server";

import { createClient } from "@/lib/supabase/server";
import { expenseFormSchema } from "../schemas/expense-schema";
import { getExpenseContext } from "./expenses";

export type ExpenseActionResult = {
  success: boolean;
  message: string;
};

async function requireOwner() {
  const context = await getExpenseContext();
  return context?.role === "owner" ? context : null;
}

function toFormValues(formData: FormData) {
  return {
    expenseDate: formData.get("expenseDate"),
    branchId: formData.get("branchId"),
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    notes: formData.get("notes"),
  };
}

export async function createExpenseAction(formData: FormData): Promise<ExpenseActionResult> {
  const context = await requireOwner();
  if (!context) {
    return { success: false, message: "Solo un propietario puede registrar egresos." };
  }

  const parsed = expenseFormSchema.safeParse(toFormValues(formData));
  if (!parsed.success) {
    return { success: false, message: "Revisa los campos marcados e intenta nuevamente." };
  }

  const supabase = await createClient();
  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("id", parsed.data.branchId)
    .eq("organization_id", context.organizationId)
    .eq("active", true)
    .maybeSingle();

  if (branchError || !branch) {
    return { success: false, message: "El local seleccionado no existe o está inactivo." };
  }

  const { error } = await supabase.from("expenses").insert({
    organization_id: context.organizationId,
    branch_id: parsed.data.branchId,
    expense_date: parsed.data.expenseDate,
    category: parsed.data.category,
    description: parsed.data.description,
    amount: parsed.data.amount,
    notes: parsed.data.notes,
    created_by: context.userId,
  });

  if (error) {
    return { success: false, message: "No pudimos registrar el egreso. Intenta nuevamente." };
  }

  return { success: true, message: "Egreso registrado correctamente." };
}

export async function voidExpenseAction(expenseId: string): Promise<ExpenseActionResult> {
  const context = await requireOwner();
  if (!context) {
    return { success: false, message: "Solo un propietario puede anular egresos." };
  }

  if (!/^[0-9a-f-]{36}$/i.test(expenseId)) {
    return { success: false, message: "Egreso inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_expense", { p_expense_id: expenseId });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("ya está anulado") || message.includes("ya esta anulado")) {
      return { success: false, message: "El egreso ya está anulado." };
    }
    if (message.includes("no encontrado")) {
      return { success: false, message: "No encontramos el egreso." };
    }
    return { success: false, message: "No pudimos anular el egreso. Intenta nuevamente." };
  }

  return { success: true, message: "Egreso anulado correctamente." };
}
