import {
  findDocumentByFiscalIdentity,
  getDocument,
} from "@/lib/intifact/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SalesContext } from "./context";
import { applyFiscalCommercialOutcome } from "./commercial-state";
import { mapIntifactStatus } from "./intifact-emission";

export type SaleFiscalStatus = {
  saleId: string;
  status: string;
  commercialStatus: string;
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

  const [{ data: sale, error }, { data: organization }] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, organization_id, document_type, series, correlative, status, commercial_status, intifact_status, intifact_document_id, intifact_last_checked_at, intifact_sunat_code, intifact_sunat_description, intifact_error_message",
        )
        .eq("id", saleId)
        .eq("organization_id", context.organizationId)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("ruc")
        .eq("id", context.organizationId)
        .maybeSingle(),
    ]);

  if (error || !sale || !organization) {
    throw new Error("No se encontró la venta.");
  }

  let documentId = sale.intifact_document_id;

  if (!documentId) {
    // Fail closed: a failed/incomplete provider lookup must NOT be treated
    // as "not found", particularly before retrying the same fiscal identity.
    const recovered = await findDocumentByFiscalIdentity({
      ruc: organization.ruc,
      documentType: sale.document_type,
      series: sale.series,
      correlative: sale.correlative,
    });

    if (recovered) {
      documentId = recovered.id;

      const admin = createAdminClient();
      const { error: recoveryError } = await admin
        .from("sales")
        .update({
          intifact_document_id: recovered.id,
          intifact_status: recovered.estado,
          intifact_last_checked_at: new Date().toISOString(),
        })
        .eq("id", saleId)
        .eq("organization_id", context.organizationId);

      if (recoveryError) {
        throw new Error("No se pudo guardar el documento recuperado de Intifact.");
      }
    }
  }

  if (!documentId) {
    return {
      saleId,
      status: sale.status,
      commercialStatus: sale.commercial_status,
      intifactStatus: sale.intifact_status,
      intifactDocumentId: null,
      pdfReady: false,
      sunatCode: sale.intifact_sunat_code,
      sunatDescription: sale.intifact_sunat_description,
      errorMessage:
        sale.intifact_error_message ||
        "No se encontró todavía el documento en Intifact. La operación sigue pendiente y no impacta caja.",
    };
  }

  if (
    sale.status === "accepted" ||
    sale.status === "rejected" ||
    sale.status === "voided"
  ) {
    return {
      saleId,
      status: sale.status,
      commercialStatus: sale.commercial_status,
      intifactStatus: sale.intifact_status,
      intifactDocumentId: documentId,
      pdfReady:
        sale.status === "accepted" &&
        sale.commercial_status === "completed",
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
      commercialStatus: sale.commercial_status,
      intifactStatus: sale.intifact_status,
      intifactDocumentId: documentId,
      pdfReady: false,
      sunatCode: sale.intifact_sunat_code,
      sunatDescription: sale.intifact_sunat_description,
      errorMessage: sale.intifact_error_message,
    };
  }

  const snapshot = await getDocument(documentId);
  const localStatus = mapIntifactStatus(snapshot.estado);
  const now = new Date().toISOString();

  const fiscalError =
    localStatus === "rejected" || localStatus === "queue_failed"
      ? snapshot.sunatDescription ||
        "Intifact reportó " + snapshot.estado + "."
      : null;

  const update: Record<string, unknown> = {
    status: localStatus,
    intifact_status: snapshot.estado,
    intifact_document_id: documentId,
    intifact_last_checked_at: now,
    intifact_sunat_code: snapshot.sunatCode,
    intifact_sunat_description: snapshot.sunatDescription,
    intifact_error_message: fiscalError,
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

  const commercialStatus = await applyFiscalCommercialOutcome(
    saleId,
    localStatus,
    fiscalError || snapshot.sunatDescription,
  );

  return {
    saleId,
    status: localStatus,
    commercialStatus,
    intifactStatus: snapshot.estado,
    intifactDocumentId: documentId,
    pdfReady:
      localStatus === "accepted" &&
      commercialStatus === "completed",
    sunatCode: snapshot.sunatCode,
    sunatDescription: snapshot.sunatDescription,
    errorMessage: fiscalError,
  };
}
