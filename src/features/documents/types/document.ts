import type { PaymentMethod } from "@/features/sales/types/sales";

export const DOCUMENTS_PER_PAGE = 20;

export type DocumentStatusFilter =
  | "all"
  | "accepted"
  | "pending"
  | "rejected"
  | "queue_failed"
  | "error"
  | "voided";

export type DocumentTypeFilter = "all" | "01" | "03";

export type DocumentFilters = {
  q: string;
  dateFrom: string;
  dateTo: string;
  branchId: string;
  documentType: DocumentTypeFilter;
  status: DocumentStatusFilter;
  page: number;
};

export type FiscalDocumentListItem = {
  id: string;
  branch_id: string;
  branch_name: string;
  document_type: "01" | "03";
  series: string;
  correlative: number;
  status:
    | "draft"
    | "queued"
    | "processing"
    | "accepted"
    | "rejected"
    | "queue_failed"
    | "voided"
    | "error";
  fiscal_issue_date: string;
  customer_document_number: string | null;
  customer_name: string | null;
  total_amount: string | number;
  intifact_document_id: string | null;
  intifact_status: string | null;
  intifact_sunat_code: string | null;
  intifact_sunat_description: string | null;
  intifact_error_message: string | null;
  intifact_last_checked_at: string | null;
  created_at: string;
};

export type DocumentSummary = {
  recordCount: number;
  acceptedCount: number;
  pendingCount: number;
  issueCount: number;
  acceptedAmount: number;
};

export type FiscalDocumentDetail = FiscalDocumentListItem & {
  customer_document_type: string | null;
  taxable_amount: string | number;
  igv_amount: string | number;
  currency: "PEN";
  intifact_hash: string | null;
  intifact_payload_hash: string | null;
  intifact_attempt_count: number;
  intifact_last_attempt_at: string | null;
  issued_at: string | null;
  accepted_at: string | null;
  voided_at: string | null;
  items: Array<{
    id: string;
    product_code: string;
    sunat_product_code: string | null;
    description: string;
    unit_code: string;
    tax_affectation_code: "10" | "20" | "30";
    quantity: string | number;
    unit_price: string | number;
    line_subtotal: string | number;
    line_igv: string | number;
    line_total: string | number;
  }>;
  payments: Array<{
    id: string;
    payment_method: PaymentMethod;
    amount: string | number;
    received_amount: string | number | null;
    change_amount: string | number;
    created_at: string;
  }>;
};
