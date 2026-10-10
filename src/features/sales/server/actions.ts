"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSalesContext } from "./context";
import type { DocumentType, PaymentMethod } from "../types/sales";

export type SalesActionResult<T = undefined> = {
  success: boolean;
  message: string;
  data?: T;
};

const uuid = z.string().uuid();
const money = z.coerce.number().finite().min(0).max(9_999_999_999.99);

async function requireContext() {
  return getSalesContext();
}

export async function openSalesSessionAction(input: {
  branchId: string;
  cashierUserId: string;
  openingCash: number;
  openingNote?: string;
}): Promise<SalesActionResult<{ sessionId: string }>> {
  const context = await requireContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };

  const parsed = z.object({
    branchId: uuid,
    cashierUserId: uuid,
    openingCash: money,
    openingNote: z.string().trim().max(300).optional(),
  }).safeParse(input);

  if (!parsed.success) return { success: false, message: "Revisa los datos de apertura." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_sales_session", {
    p_branch_id: parsed.data.branchId,
    p_cashier_user_id: parsed.data.cashierUserId,
    p_opening_cash: parsed.data.openingCash,
    p_opening_note: parsed.data.openingNote || null,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("ya existe")) {
      return { success: false, message: "Ya existe una sesión abierta para este local." };
    }
    return { success: false, message: "No pudimos abrir la sesión de caja." };
  }

  return { success: true, message: "Sesión de caja abierta.", data: { sessionId: data as string } };
}

export async function registerCashMovementAction(input: {
  sessionId: string;
  movementType: "in" | "out";
  reasonCode: string;
  amount: number;
  description?: string;
}): Promise<SalesActionResult> {
  const context = await requireContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };

  const parsed = z.object({
    sessionId: uuid,
    movementType: z.enum(["in", "out"]),
    reasonCode: z.enum(["change", "cash_in", "safe_withdrawal", "supplies", "supplier_payment", "other"]),
    amount: money.refine((value) => value > 0, "Monto inválido."),
    description: z.string().trim().max(300).optional(),
  }).safeParse(input);

  if (!parsed.success) return { success: false, message: "Revisa el movimiento de caja." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_cash_movement", {
    p_session_id: parsed.data.sessionId,
    p_movement_type: parsed.data.movementType,
    p_reason_code: parsed.data.reasonCode,
    p_amount: parsed.data.amount,
    p_description: parsed.data.description || null,
  });

  if (error) {
    if (error.message.toLowerCase().includes("supera el efectivo")) {
      return { success: false, message: "La salida supera el efectivo esperado en caja." };
    }
    return { success: false, message: "No pudimos registrar el movimiento." };
  }

  return { success: true, message: "Movimiento de caja registrado." };
}

export async function closeSalesSessionAction(input: {
  sessionId: string;
  countedCash: number;
  closingNote?: string;
}): Promise<SalesActionResult<{ expectedCash: number; countedCash: number; difference: number }>> {
  const context = await requireContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };

  const parsed = z.object({
    sessionId: uuid,
    countedCash: money,
    closingNote: z.string().trim().max(500).optional(),
  }).safeParse(input);

  if (!parsed.success) return { success: false, message: "Revisa el arqueo de caja." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_sales_session", {
    p_session_id: parsed.data.sessionId,
    p_counted_cash: parsed.data.countedCash,
    p_closing_note: parsed.data.closingNote || null,
  });

  if (error) {
    if (error.message.toLowerCase().includes("observación")) {
      return { success: false, message: "Explica la diferencia de caja antes de cerrar." };
    }
    return { success: false, message: "No pudimos cerrar la sesión." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: true,
    message: "Sesión cerrada correctamente.",
    data: {
      expectedCash: Number(row?.expected_cash ?? 0),
      countedCash: Number(row?.counted_cash ?? 0),
      difference: Number(row?.cash_difference ?? 0),
    },
  };
}

export async function createCustomerAction(input: {
  documentType: "1" | "6";
  documentNumber: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}): Promise<SalesActionResult<{ customerId: string }>> {
  const context = await requireContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };

  const parsed = z.object({
    documentType: z.enum(["1", "6"]),
    documentNumber: z.string().trim(),
    name: z.string().trim().min(2).max(160),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.literal(""), z.string().email()]).optional(),
    address: z.string().trim().max(300).optional(),
  }).superRefine((value, ctx) => {
    const expected = value.documentType === "1" ? 8 : 11;
    if (!new RegExp(`^\\d{${expected}}$`).test(value.documentNumber)) {
      ctx.addIssue({ code: "custom", path: ["documentNumber"], message: "Documento inválido." });
    }
  }).safeParse(input);

  if (!parsed.success) return { success: false, message: "Revisa los datos del cliente." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_customer", {
    p_organization_id: context.organizationId,
    p_document_type: parsed.data.documentType,
    p_document_number: parsed.data.documentNumber,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_address: parsed.data.address || null,
  });

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
      return { success: false, message: "Ya existe un cliente con ese documento." };
    }
    return { success: false, message: "No pudimos registrar el cliente." };
  }

  return { success: true, message: "Cliente registrado.", data: { customerId: data as string } };
}

export async function createPosSaleAction(input: {
  sessionId: string;
  documentType: DocumentType;
  series: string;
  customerId: string | null;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  receivedAmount?: number | null;
}): Promise<SalesActionResult<{
  saleId: string;
  series: string;
  correlative: number;
  totalAmount: number;
  changeAmount: number;
}>> {
  const context = await requireContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };

  const parsed = z.object({
    sessionId: uuid,
    documentType: z.enum(["01", "03"]),
    series: z.string().trim().regex(/^[A-Z0-9]{4}$/),
    customerId: z.union([uuid, z.null()]),
    items: z.array(z.object({
      productId: uuid,
      quantity: z.number().positive().max(999),
    })).min(1),
    paymentMethod: z.enum(["cash", "yape", "plin", "card", "transfer"]),
    receivedAmount: z.number().nonnegative().nullable().optional(),
  }).safeParse(input);

  if (!parsed.success) return { success: false, message: "Revisa los datos de la venta." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_pos_sale", {
    p_session_id: parsed.data.sessionId,
    p_document_type: parsed.data.documentType,
    p_series: parsed.data.series,
    p_customer_id: parsed.data.customerId,
    p_items: parsed.data.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
    p_payment_method: parsed.data.paymentMethod,
    p_received_amount: parsed.data.receivedAmount ?? null,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("factura requiere")) {
      return { success: false, message: "La factura requiere seleccionar un cliente con RUC." };
    }
    if (message.includes("efectivo recibido")) {
      return { success: false, message: "El efectivo recibido no cubre el total." };
    }
    if (message.includes("serie activa")) {
      return { success: false, message: "No hay una serie activa para este comprobante." };
    }
    if (message.includes("sesión") || message.includes("sesion")) {
      return { success: false, message: "La sesión de caja ya no está disponible." };
    }
    return { success: false, message: "No pudimos registrar la venta." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: true,
    message: "Venta cobrada y registrada.",
    data: {
      saleId: row.sale_id,
      series: row.series,
      correlative: Number(row.correlative),
      totalAmount: Number(row.total_amount),
      changeAmount: Number(row.change_amount),
    },
  };
}
