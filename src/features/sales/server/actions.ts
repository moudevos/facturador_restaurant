"use server";

import { z } from "zod";

import { lookupIdentityDocument, ApiPeruError } from "@/lib/apiperu/client";
import { assertIntifactConfigured } from "@/lib/intifact/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSalesContext } from "./context";
import type { DocumentType, PaymentMethod } from "../types/sales";
import { emitPersistedSaleToIntifact, validateWithIntifactCompute } from "./intifact-emission";
import { assertIntifactIssuerReady } from "./intifact-preflight";

export type SalesActionResult<T = undefined> = {
  success: boolean;
  message: string;
  code?: string;
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
    const message = error.message.toLowerCase();
    if (message.includes("observación")) {
      return { success: false, message: "Explica la diferencia de caja antes de cerrar." };
    }
    if (message.includes("pendientes de confirmación fiscal")) {
      return {
        success: false,
        message:
          "Hay ventas pendientes de confirmación fiscal. Actualiza sus estados antes de cerrar la sesión.",
      };
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

export async function lookupCustomerDocumentAction(input: {
  documentNumber: string;
}): Promise<SalesActionResult<{
  documentType: "1" | "6";
  documentNumber: string;
  name: string;
  address: string | null;
  taxpayerStatus: string | null;
  taxpayerCondition: string | null;
}>> {
  const context = await requireContext();
  if (!context) {
    return { success: false, message: "Tu sesión de usuario no es válida." };
  }

  const parsed = z.object({
    documentNumber: z.string().trim().regex(/^(\d{8}|\d{11})$/),
  }).safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos.",
    };
  }

  try {
    const result = await lookupIdentityDocument(parsed.data.documentNumber);

    return {
      success: true,
      message: "Documento verificado con ApiPeru.",
      data: result,
    };
  } catch (error) {
    if (error instanceof ApiPeruError) {
      if (error.code === "document_not_found") {
        return {
          success: false,
          code: "document_not_found",
          message:
            parsed.data.documentNumber.length === 8
              ? "ApiPeru no encontró este DNI en sus fuentes públicas."
              : "El RUC no fue encontrado en ApiPeru/SUNAT.",
        };
      }

      if (error.code === "invalid_input") {
        return { success: false, message: "El número de documento no es válido." };
      }

      if (error.retryable) {
        return {
          success: false,
          message: "ApiPeru no está disponible temporalmente. Intenta nuevamente en unos segundos.",
        };
      }

      if (error.status === 401 || error.status === 403) {
        return {
          success: false,
          message: "La integración ApiPeru no está autorizada. Revisa el token del servidor.",
        };
      }

      if (error.status === 429) {
        return {
          success: false,
          message: "Se alcanzó el límite de consultas de ApiPeru.",
        };
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No pudimos verificar el documento.",
    };
  }
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

export async function createManualCustomerAction(input: {
  documentNumber: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}): Promise<SalesActionResult<{ customerId: string }>> {
  const context = await requireContext();
  if (!context) {
    return {
      success: false,
      message: "Tu sesión de usuario no es válida.",
    };
  }

  const parsed = z.object({
    documentNumber: z.string().trim().regex(/^\d{8}$/),
    name: z.string().trim().min(2).max(160),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.literal(""), z.string().email()]).optional(),
    address: z.string().trim().max(300).optional(),
  }).safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa el DNI y el nombre ingresados manualmente.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_manual_customer", {
    p_organization_id: context.organizationId,
    p_document_number: parsed.data.documentNumber,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_address: parsed.data.address || null,
  });

  if (error) {
    if (
      error.code === "23505" ||
      error.message.toLowerCase().includes("duplicate")
    ) {
      return {
        success: false,
        message: "Ya existe un cliente con ese DNI.",
      };
    }

    return {
      success: false,
      message: "No pudimos registrar el cliente manual.",
    };
  }

  return {
    success: true,
    message: "Cliente registrado manualmente.",
    data: { customerId: data as string },
  };
}

export async function createPosSaleAction(input: {
  sessionId: string;
  documentType: DocumentType;
  series: string;
  customerId?: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  receivedAmount?: number | null;
}): Promise<SalesActionResult<{
  saleId: string;
  series: string;
  correlative: number;
  totalAmount: number;
  changeAmount: number;
  fiscalStatus: string;
  commercialStatus: string;
  paymentMethod: PaymentMethod;
  intifactDocumentId: string | null;
  pdfReady: boolean;
  fiscalMessage: string | null;
}>> {
  const context = await requireContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };

  const parsed = z.object({
    sessionId: uuid,
    documentType: z.enum(["01", "03"]),
    series: z.string().trim().regex(/^[A-Z0-9]{4}$/),
    customerId: uuid.optional(),
    items: z.array(z.object({
      productId: uuid,
      quantity: z.number().positive().max(999),
    })).min(1),
    paymentMethod: z.enum(["cash", "yape", "plin", "card", "transfer"]),
    receivedAmount: z.number().nonnegative().nullable().optional(),
  }).safeParse(input);

  if (!parsed.success) return { success: false, message: "Revisa los datos de la venta." };

  let computeData;
  try {
    assertIntifactConfigured();
    createAdminClient();
    await assertIntifactIssuerReady(context);
    computeData = await validateWithIntifactCompute(context, parsed.data.items);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No pudimos validar la venta con Intifact.",
    };
  }

  if (
    parsed.data.documentType === "03" &&
    !parsed.data.customerId &&
    Number(computeData.montoImpVenta) > 700
  ) {
    return {
      success: false,
      message: "SUNAT exige identificar al comprador cuando la boleta supera S/ 700. Selecciona un cliente con documento antes de cobrar.",
    };
  }

  const supabase = await createClient();

  const isTest = process.env.INTIFACT_API_KEY?.startsWith("fact_test_") ?? false;

  if (!isTest) {
    const [
      { data: organization },
      { data: session },
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select(
          "fiscal_verified, intifact_company_id, sunat_status, sunat_condition",
        )
        .eq("id", context.organizationId)
        .maybeSingle(),
      supabase
        .from("sales_sessions")
        .select("branch_id, status")
        .eq("id", parsed.data.sessionId)
        .eq("organization_id", context.organizationId)
        .maybeSingle(),
    ]);

    if (
      !organization?.fiscal_verified ||
      !organization.intifact_company_id ||
      organization.sunat_status?.toUpperCase() !== "ACTIVO" ||
      organization.sunat_condition?.toUpperCase() !== "HABIDO"
    ) {
      return {
        success: false,
        message:
          "Antes de emitir en producción verifica el RUC ACTIVO/HABIDO y vincúlalo con Intifact en Configuración > Comprobante.",
      };
    }

    if (!session || session.status !== "open") {
      return {
        success: false,
        message: "La sesión de caja ya no está disponible.",
      };
    }

    const { data: branch } = await supabase
      .from("branches")
      .select("sunat_establishment_code")
      .eq("id", session.branch_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();

    if (!branch?.sunat_establishment_code) {
      return {
        success: false,
        message:
          "El local no tiene código de establecimiento SUNAT. Impórtalo desde Configuración > Comprobante.",
      };
    }
  }

  const { data, error } = await supabase.rpc("create_pos_sale", {
    p_session_id: parsed.data.sessionId,
    p_document_type: parsed.data.documentType,
    p_series: parsed.data.series,
    p_customer_id: parsed.data.customerId ?? null,
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
    if (message.includes("tax_affectation_code")) {
      return {
        success: false,
        message: "Falta aplicar SQL 011 antes de emitir comprobantes.",
      };
    }
    return { success: false, message: "No pudimos registrar la venta." };
  }

  const row = Array.isArray(data) ? data[0] : data;

  try {
    const emission = await emitPersistedSaleToIntifact(
      context,
      row.sale_id,
      computeData,
    );

    return {
      success: true,
      message:
        emission.localStatus === "accepted"
          ? "Venta aceptada y completada."
          : "Operación enviada a Intifact. No impactará caja hasta la aceptación fiscal.",
      data: {
        saleId: row.sale_id,
        series: row.series,
        correlative: Number(row.correlative),
        totalAmount: Number(row.total_amount),
        changeAmount: Number(row.change_amount),
        fiscalStatus: emission.localStatus,
        commercialStatus: emission.commercialStatus,
        paymentMethod: parsed.data.paymentMethod,
        intifactDocumentId: emission.documentId,
        pdfReady:
          emission.localStatus === "accepted" &&
          emission.commercialStatus === "completed",
        fiscalMessage: null,
      },
    };
  } catch (error) {
    const fiscalMessage =
      error instanceof Error
        ? error.message
        : "No se pudo determinar el resultado fiscal.";

    const { data: saleState } = await supabase
      .from("sales")
      .select(
        "status, commercial_status, intifact_document_id, intifact_error_message",
      )
      .eq("id", row.sale_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();

    const commercialStatus =
      saleState?.commercial_status ?? "pending";
    const fiscalStatus = saleState?.status ?? "error";

    return {
      success: true,
      message:
        commercialStatus === "failed"
          ? "El comprobante no fue emitido. La operación fue revertida y no se contabiliza como venta."
          : "La operación quedó pendiente de reconciliación fiscal y no se contabiliza en caja.",
      data: {
        saleId: row.sale_id,
        series: row.series,
        correlative: Number(row.correlative),
        totalAmount: Number(row.total_amount),
        changeAmount: Number(row.change_amount),
        fiscalStatus,
        commercialStatus,
        paymentMethod: parsed.data.paymentMethod,
        intifactDocumentId: saleState?.intifact_document_id ?? null,
        pdfReady: false,
        fiscalMessage:
          saleState?.intifact_error_message || fiscalMessage,
      },
    };
  }
}
