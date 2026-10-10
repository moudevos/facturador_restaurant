import type { ReceiptData } from "../types/receipt";
import type { SalesContext } from "@/features/sales/server/context";
import { PAYMENT_LABELS } from "@/features/sales/utils/format";
import { createClient } from "@/lib/supabase/server";

function formatFiscalDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return day + "/" + month + "/" + year;
}

function formatIssueTime(value: string | null, timeZone: string) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export async function getReceiptData(
  context: SalesContext,
  saleId: string,
): Promise<ReceiptData | null> {
  const supabase = await createClient();

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select(
      "id, organization_id, branch_id, document_type, series, correlative, status, commercial_status, fiscal_issue_date, issued_at, accepted_at, created_at, customer_document_type, customer_document_number, customer_name, taxable_amount, igv_amount, total_amount",
    )
    .eq("id", saleId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (
    saleError ||
    !sale ||
    sale.status !== "accepted" ||
    sale.commercial_status !== "completed"
  ) {
    return null;
  }

  const [
    organizationResult,
    branchResult,
    itemsResult,
    paymentResult,
    settingsResult,
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("ruc, legal_name, trade_name")
      .eq("id", context.organizationId)
      .maybeSingle(),
    supabase
      .from("branches")
      .select("name, address")
      .eq("id", sale.branch_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
    supabase
      .from("sale_items")
      .select(
        "product_code, description, unit_code, tax_affectation_code, quantity, unit_price, line_subtotal, line_igv, line_total",
      )
      .eq("sale_id", saleId)
      .eq("organization_id", context.organizationId)
      .order("created_at"),
    supabase
      .from("sale_payments")
      .select(
        "payment_method, amount, received_amount, change_amount",
      )
      .eq("sale_id", saleId)
      .eq("organization_id", context.organizationId)
      .eq("status", "completed")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("receipt_settings")
      .select(
        "logo_path, footer_text, paper_width, printer_mode, auto_print, show_product_code, show_payment_method",
      )
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
  ]);

  const organization = organizationResult.data;
  if (!organization || itemsResult.error) return null;

  const settings = settingsResult.data;
  const logoUrl = settings?.logo_path
    ? supabase.storage
        .from("organization-assets")
        .getPublicUrl(settings.logo_path).data.publicUrl
    : null;

  const items = itemsResult.data ?? [];
  const exoneratedAmount = items
    .filter((item) => item.tax_affectation_code === "20")
    .reduce((sum, item) => sum + Number(item.line_subtotal), 0);
  const unaffectedAmount = items
    .filter((item) => item.tax_affectation_code === "30")
    .reduce((sum, item) => sum + Number(item.line_subtotal), 0);

  const publicBase = (
    process.env.INTIFACT_API_URL || "https://api-facturacion.intifact.com"
  ).replace(/\/$/, "");

  const paymentMethod = paymentResult.data?.payment_method;
  const paymentLabel =
    paymentMethod && paymentMethod in PAYMENT_LABELS
      ? PAYMENT_LABELS[paymentMethod as keyof typeof PAYMENT_LABELS]
      : null;

  const issueTimestamp =
    sale.issued_at || sale.accepted_at || sale.created_at;

  const clientDocumentLabel =
    sale.customer_document_type === "6"
      ? "RUC"
      : sale.customer_document_type === "1"
        ? "DNI"
        : sale.customer_document_number
          ? "DOC"
          : null;

  return {
    saleId: sale.id,
    documentNumber:
      sale.series + "-" + String(sale.correlative).padStart(8, "0"),
    documentTypeLabel:
      sale.document_type === "01"
        ? "FACTURA ELECTRÓNICA"
        : "BOLETA DE VENTA ELECTRÓNICA",
    fiscalDate: sale.fiscal_issue_date,
    issueDateLabel: formatFiscalDate(sale.fiscal_issue_date),
    issueTimeLabel: formatIssueTime(issueTimestamp, context.timeZone),
    acceptedAt: sale.accepted_at,
    displayName: organization.trade_name || organization.legal_name,
    legalName: organization.legal_name,
    ruc: organization.ruc,
    branchName: branchResult.data?.name ?? "Local",
    branchAddress: branchResult.data?.address ?? null,
    clientName: sale.customer_name || "CLIENTE VARIOS",
    clientDocument: sale.customer_document_number,
    clientDocumentLabel,
    paymentLabel,
    paymentAmount:
      paymentResult.data?.amount === null ||
      paymentResult.data?.amount === undefined
        ? null
        : Number(paymentResult.data.amount),
    receivedAmount:
      paymentResult.data?.received_amount === null ||
      paymentResult.data?.received_amount === undefined
        ? null
        : Number(paymentResult.data.received_amount),
    changeAmount: Number(paymentResult.data?.change_amount ?? 0),
    items: items.map((item) => ({
      code: item.product_code,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit_code,
      unitPrice: Number(item.unit_price),
      total: Number(item.line_total),
    })),
    taxableAmount: Number(sale.taxable_amount),
    exoneratedAmount,
    unaffectedAmount,
    igvAmount: Number(sale.igv_amount),
    totalAmount: Number(sale.total_amount),
    logoUrl,
    footerText: settings?.footer_text ?? null,
    showProductCode: Boolean(settings?.show_product_code),
    showPaymentMethod: settings?.show_payment_method !== false,
    paperWidth:
      settings?.paper_width === "58" ||
      settings?.paper_width === "80" ||
      settings?.paper_width === "a4"
        ? settings.paper_width
        : "48",
    printerMode:
      settings?.printer_mode === "bluetooth-ble" ||
      settings?.printer_mode === "android-bridge"
        ? settings.printer_mode
        : "system",
    autoPrint: Boolean(settings?.auto_print),
    verificationUrl:
      publicBase +
      "/api/v1/public/consultar/" +
      organization.ruc +
      "/" +
      sale.document_type +
      "/" +
      sale.series +
      "/" +
      sale.correlative,
    isTest: process.env.INTIFACT_API_KEY?.startsWith("fact_test_") ?? true,
  };
}
