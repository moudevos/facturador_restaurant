import { createClient } from "@/lib/supabase/server";
import type { SalesContext } from "@/features/sales/server/context";
import {
  DOCUMENTS_PER_PAGE,
  type DocumentFilters,
  type DocumentSummary,
  type FiscalDocumentDetail,
  type FiscalDocumentListItem,
} from "../types/document";

const DOCUMENT_SELECT =
  "id, branch_id, document_type, series, correlative, status, fiscal_issue_date, customer_document_number, customer_name, total_amount, intifact_document_id, intifact_status, intifact_sunat_code, intifact_sunat_description, intifact_error_message, intifact_last_checked_at, created_at";

function normalizeSearch(value: string) {
  return value.replace(/[,()%]/g, " ").trim().slice(0, 120);
}

export async function listDocuments(
  context: SalesContext,
  filters: DocumentFilters,
) {
  const supabase = await createClient();
  const query = normalizeSearch(filters.q);

  let request = supabase
    .from("sales")
    .select(DOCUMENT_SELECT, { count: "exact" })
    .eq("organization_id", context.organizationId)
    .gte("fiscal_issue_date", filters.dateFrom)
    .lte("fiscal_issue_date", filters.dateTo);

  if (filters.branchId) request = request.eq("branch_id", filters.branchId);
  if (filters.documentType !== "all") {
    request = request.eq("document_type", filters.documentType);
  }

  if (filters.status === "pending") {
    request = request.in("status", ["draft", "queued", "processing"]);
  } else if (filters.status !== "all") {
    request = request.eq("status", filters.status);
  }

  if (query) {
    const clauses = [
      `series.ilike.%${query}%`,
      `customer_name.ilike.%${query}%`,
      `customer_document_number.ilike.%${query}%`,
    ];
    if (/^\d+$/.test(query)) clauses.push(`correlative.eq.${query}`);
    request = request.or(clauses.join(","));
  }

  const from = (filters.page - 1) * DOCUMENTS_PER_PAGE;

  const [documentsResult, branchesResult, summaryResult] = await Promise.all([
    request
      .order("fiscal_issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + DOCUMENTS_PER_PAGE - 1),
    supabase
      .from("branches")
      .select("id, code, name")
      .eq("organization_id", context.organizationId),
    supabase.rpc("document_filtered_summary", {
      p_organization_id: context.organizationId,
      p_branch_id: filters.branchId || null,
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_document_type:
        filters.documentType === "all" ? null : filters.documentType,
      p_status: filters.status,
      p_query: query || null,
    }),
  ]);

  const branchMap = new Map(
    (branchesResult.data ?? []).map((branch) => [
      branch.id,
      `${branch.code} · ${branch.name}`,
    ]),
  );

  const rows = (documentsResult.data ?? []) as Omit<
    FiscalDocumentListItem,
    "branch_name"
  >[];

  const summaryRow = Array.isArray(summaryResult.data)
    ? summaryResult.data[0]
    : summaryResult.data;

  const summary: DocumentSummary = {
    recordCount: Number(summaryRow?.record_count ?? documentsResult.count ?? 0),
    acceptedCount: Number(summaryRow?.accepted_count ?? 0),
    pendingCount: Number(summaryRow?.pending_count ?? 0),
    issueCount: Number(summaryRow?.issue_count ?? 0),
    acceptedAmount: Number(summaryRow?.accepted_amount ?? 0),
  };

  return {
    documents: rows.map((row) => ({
      ...row,
      branch_name: branchMap.get(row.branch_id) ?? "Local",
    })),
    count: documentsResult.count ?? 0,
    summary,
    errorMessage:
      documentsResult.error || branchesResult.error || summaryResult.error
        ? "No pudimos cargar todos los comprobantes. Verifica que SQL 013 esté aplicado."
        : null,
  };
}

export async function getDocumentDetail(
  context: SalesContext,
  saleId: string,
): Promise<FiscalDocumentDetail | null> {
  const supabase = await createClient();

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select(
      `${DOCUMENT_SELECT}, customer_document_type, taxable_amount, igv_amount, currency, intifact_hash, intifact_payload_hash, intifact_attempt_count, intifact_last_attempt_at, issued_at, accepted_at, voided_at`,
    )
    .eq("id", saleId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (saleError || !sale) return null;

  const [branchResult, itemsResult, paymentsResult] = await Promise.all([
    supabase
      .from("branches")
      .select("code, name")
      .eq("id", sale.branch_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
    supabase
      .from("sale_items")
      .select(
        "id, product_code, sunat_product_code, description, unit_code, tax_affectation_code, quantity, unit_price, line_subtotal, line_igv, line_total",
      )
      .eq("sale_id", saleId)
      .eq("organization_id", context.organizationId)
      .order("created_at"),
    supabase
      .from("sale_payments")
      .select("id, payment_method, amount, received_amount, change_amount, created_at")
      .eq("sale_id", saleId)
      .eq("organization_id", context.organizationId)
      .order("created_at"),
  ]);

  if (itemsResult.error || paymentsResult.error) return null;

  return {
    ...(sale as Omit<FiscalDocumentDetail, "branch_name" | "items" | "payments">),
    branch_name: branchResult.data
      ? `${branchResult.data.code} · ${branchResult.data.name}`
      : "Local",
    items: (itemsResult.data ?? []) as FiscalDocumentDetail["items"],
    payments: (paymentsResult.data ?? []) as FiscalDocumentDetail["payments"],
  };
}
