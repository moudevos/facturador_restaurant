import { getDocument } from "@/lib/intifact/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SalesContext } from "./context";
import { mapIntifactStatus } from "./intifact-emission";

export type SaleFiscalStatus = {
  saleId: string;
  status: string;
  intifactStatus: string | null;
  intifactDocumentId: string | null;
  pdfReady: boolean;
  sunatCode: string | null;
  sunatDescription: string | null;
  errorMessage: string | null;
};

export async function syncSaleIntifactStatus(
  context: SalesContext,
  saleId: string,
): Promise<SaleFiscalStatus> {
  const supabase = await createClient();
  const { data: sale, error } = await supabase
    .from("sales")
    .select(
      "id, organization_id, status, intifact_status, intifact_document_id, intifact_last_checked_at, intifact_sunat_code, intifact_sunat_description, intifact_error_message",
    )
    .eq("id", saleId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (error || !sale) {
    throw new Error("No se encontró la venta.");
  }

  if (!sale.intifact_document_id) {
    return {
      saleId,
      status: sale.status,
      intifactStatus: sale.intifact_status,
      intifactDocumentId: null,
      pdfReady: false,
      sunatCode: sale.intifact_sunat_code,
      sunatDescription: sale.intifact_sunat_description,
      errorMessage: sale.intifact_error_message,
    };
  }

  if (sale.status === "accepted" || sale.status === "rejected" || sale.status === "voided") {
    return {
      saleId,
      status: sale.status,
      intifactStatus: sale.intifact_status,
      intifactDocumentId: sale.intifact_document_id,
      pdfReady: sale.status === "accepted",
      sunatCode: sale.intifact_sunat_code,
      sunatDescription: sale.intifact_sunat_description,
      errorMessage: sale.intifact_error_message,
    };
  }

  const lastChecked = sale.intifact_last_checked_at
    ? new Date(sale.intifact_last_checked_at).getTime()
    : 0;

  if (Date.now() - lastChecked < 4_000) {
    return {
      saleId,
      status: sale.status,
      intifactStatus: sale.intifact_status,
      intifactDocumentId: sale.intifact_document_id,
      pdfReady: false,
      sunatCode: sale.intifact_sunat_code,
      sunatDescription: sale.intifact_sunat_description,
      errorMessage: sale.intifact_error_message,
    };
  }

  const snapshot = await getDocument(sale.intifact_document_id);
  const localStatus = mapIntifactStatus(snapshot.estado);
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    status: localStatus,
    intifact_status: snapshot.estado,
    intifact_last_checked_at: now,
    intifact_sunat_code: snapshot.sunatCode,
    intifact_sunat_description: snapshot.sunatDescription,
    intifact_error_message:
      localStatus === "rejected" || localStatus === "queue_failed"
        ? snapshot.sunatDescription ?? `Intifact reportó ${snapshot.estado}.`
        : null,
  };

  if (localStatus === "accepted") {
    update.accepted_at = now;
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("sales")
    .update(update)
    .eq("id", saleId)
    .eq("organization_id", context.organizationId);

  if (updateError) {
    throw new Error("No se pudo persistir el estado fiscal.");
  }

  return {
    saleId,
    status: localStatus,
    intifactStatus: snapshot.estado,
    intifactDocumentId: sale.intifact_document_id,
    pdfReady: localStatus === "accepted",
    sunatCode: snapshot.sunatCode,
    sunatDescription: snapshot.sunatDescription,
    errorMessage:
      typeof update.intifact_error_message === "string"
        ? update.intifact_error_message
        : null,
  };
}
