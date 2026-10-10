import type { FiscalDocumentListItem } from "../types/document";

export const DOCUMENT_STATUS_LABELS: Record<FiscalDocumentListItem["status"], string> = {
  draft: "Pendiente",
  queued: "Encolado",
  processing: "Procesando",
  accepted: "Aceptado",
  rejected: "Rechazado",
  queue_failed: "Cola fallida",
  voided: "Anulado",
  error: "Error",
};

export function documentStatusClass(status: FiscalDocumentListItem["status"]) {
  switch (status) {
    case "accepted":
      return "bg-emerald-50 text-emerald-700";
    case "queued":
    case "processing":
    case "draft":
      return "bg-blue-50 text-blue-700";
    case "rejected":
    case "queue_failed":
    case "error":
      return "bg-red-50 text-red-700";
    case "voided":
      return "bg-[#e9e4d6] text-[#59665f]";
  }
}

export function documentNumber(
  series: string,
  correlative: number | string,
) {
  return `${series}-${String(correlative).padStart(8, "0")}`;
}

export function documentTypeLabel(type: "01" | "03") {
  return type === "01" ? "Factura" : "Boleta";
}
