"use server";

import { z } from "zod";

import { getSalesContext } from "@/features/sales/server/context";
import { syncSaleIntifactStatus } from "@/features/sales/server/intifact-status";
import { retryDocument } from "@/lib/intifact/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DocumentActionResult = {
  success: boolean;
  message: string;
  data?: { updated?: number; failed?: number };
};

const uuid = z.string().uuid();

export async function syncDocumentsAction(
  saleIds: string[],
): Promise<DocumentActionResult> {
  const context = await getSalesContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };

  const parsed = z.array(uuid).min(1).max(10).safeParse(saleIds);
  if (!parsed.success) {
    return { success: false, message: "Selecciona hasta 10 comprobantes para actualizar." };
  }

  let updated = 0;
  let failed = 0;

  for (const saleId of parsed.data) {
    try {
      await syncSaleIntifactStatus(context, saleId);
      updated += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    success: failed === 0,
    message:
      failed === 0
        ? `Se actualizaron ${updated} comprobantes.`
        : `Se actualizaron ${updated}; ${failed} no pudieron sincronizarse.`,
    data: { updated, failed },
  };
}

export async function retryFiscalDocumentAction(
  saleId: string,
): Promise<DocumentActionResult> {
  const context = await getSalesContext();
  if (!context) return { success: false, message: "Tu sesión de usuario no es válida." };
  if (context.role !== "owner") {
    return { success: false, message: "Solo el owner puede reintentar una emisión fiscal." };
  }

  const parsed = uuid.safeParse(saleId);
  if (!parsed.success) return { success: false, message: "Comprobante inválido." };

  const supabase = await createClient();
  const { data: sale, error } = await supabase
    .from("sales")
    .select("id, status, intifact_document_id, intifact_attempt_count")
    .eq("id", parsed.data)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (error || !sale) return { success: false, message: "Comprobante no encontrado." };
  if (sale.status !== "queue_failed") {
    return {
      success: false,
      message: "El retry solo está habilitado para documentos en COLA_FALLIDA.",
    };
  }
  if (!sale.intifact_document_id) {
    return { success: false, message: "El comprobante no tiene ID de Intifact." };
  }

  try {
    const response = await retryDocument(sale.intifact_document_id);
    const raw = response.data ?? {};
    const estado =
      typeof raw.estado === "string" ? raw.estado : "ENCOLADO";
    const now = new Date().toISOString();

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("sales")
      .update({
        status: "queued",
        intifact_status: estado,
        intifact_attempt_count: Number(sale.intifact_attempt_count ?? 0) + 1,
        intifact_last_attempt_at: now,
        intifact_last_checked_at: now,
        intifact_error_message: null,
      })
      .eq("id", sale.id)
      .eq("organization_id", context.organizationId);

    if (updateError) throw new Error("No se pudo persistir el retry.");

    return {
      success: true,
      message: "Documento reencolado en Intifact con la misma identidad fiscal.",
    };
  } catch (retryError) {
    return {
      success: false,
      message:
        retryError instanceof Error
          ? retryError.message
          : "No se pudo reintentar el documento.",
    };
  }
}
