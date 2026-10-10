import { createHash } from "node:crypto";

import { getBusinessDateISO } from "@/lib/date-time";
import { computeInvoice, IntifactApiError, sendInvoice } from "@/lib/intifact/client";
import type { IntifactComputeData } from "@/lib/intifact/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SalesContext } from "./context";

type RequestedItem = { productId: string; quantity: number };

type PersistedSaleItem = {
  product_id: string | null;
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
};

export async function validateWithIntifactCompute(
  context: SalesContext,
  items: RequestedItem[],
) {
  const supabase = await createClient();
  const ids = [...new Set(items.map((item) => item.productId))];

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, tax_affectation_code, active")
    .eq("organization_id", context.organizationId)
    .eq("active", true)
    .in("id", ids);

  if (error || !products || products.length !== ids.length) {
    throw new Error("Uno o más productos ya no están disponibles.");
  }

  const byId = new Map(products.map((product) => [product.id, product]));
  const expectedTotal = items.reduce((sum, item) => {
    const product = byId.get(item.productId);
    return sum + Number(product?.price ?? 0) * item.quantity;
  }, 0);

  const computed = await computeInvoice({
    tipoMoneda: "PEN",
    preciosIncluyenIgv: true,
    items: items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) throw new Error("Producto no disponible.");

      return {
        descripcion: product.name,
        cantidad: item.quantity,
        valorUnitario: Number(product.price),
        afectacion: product.tax_affectation_code as "10" | "20" | "30",
      };
    }),
  });

  const computedTotal = Number(computed.montoImpVenta ?? expectedTotal);
  if (Math.abs(computedTotal - expectedTotal) > 0.02) {
    throw new Error(
      `Intifact calculó ${computedTotal.toFixed(2)} y el POS ${expectedTotal.toFixed(2)}. La venta no fue creada.`,
    );
  }

  return computed;
}

export async function emitPersistedSaleToIntifact(
  context: SalesContext,
  saleId: string,
  computeData: IntifactComputeData,
) {
  const supabase = await createClient();

  const [{ data: sale, error: saleError }, { data: organization, error: orgError }] =
    await Promise.all([
      supabase
        .from("sales")
        .select(
          "id, organization_id, branch_id, customer_id, document_type, series, correlative, currency, customer_document_type, customer_document_number, customer_name, total_amount",
        )
        .eq("id", saleId)
        .eq("organization_id", context.organizationId)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("ruc, timezone")
        .eq("id", context.organizationId)
        .maybeSingle(),
    ]);

  if (saleError || !sale || orgError || !organization) {
    throw new Error("No se pudo reconstruir la venta para emitirla.");
  }

  const [
    { data: branch, error: branchError },
    { data: rawItems, error: itemsError },
    customerResult,
  ] = await Promise.all([
    supabase
      .from("branches")
      .select("sunat_establishment_code")
      .eq("id", sale.branch_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
    supabase
      .from("sale_items")
      .select(
        "product_id, product_code, sunat_product_code, description, unit_code, tax_affectation_code, quantity, unit_price, line_subtotal, line_igv, line_total",
      )
      .eq("sale_id", saleId)
      .eq("organization_id", context.organizationId)
      .order("created_at"),
    sale.customer_id
      ? supabase
          .from("customers")
          .select("address")
          .eq("id", sale.customer_id)
          .eq("organization_id", context.organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (branchError || !branch || itemsError || !rawItems?.length || customerResult.error) {
    throw new Error("Faltan datos fiscales para emitir la venta.");
  }

  const items = rawItems as PersistedSaleItem[];
  const gravadas = round(
    items
      .filter((item) => item.tax_affectation_code === "10")
      .reduce((sum, item) => sum + Number(item.line_subtotal), 0),
  );
  const exoneradas = round(
    items
      .filter((item) => item.tax_affectation_code === "20")
      .reduce((sum, item) => sum + Number(item.line_subtotal), 0),
  );
  const inafectas = round(
    items
      .filter((item) => item.tax_affectation_code === "30")
      .reduce((sum, item) => sum + Number(item.line_subtotal), 0),
  );
  const igv = round(items.reduce((sum, item) => sum + Number(item.line_igv), 0));
  const valorVenta = round(items.reduce((sum, item) => sum + Number(item.line_subtotal), 0));
  const total = round(Number(sale.total_amount));
  const businessDate = getBusinessDateISO(new Date(), organization.timezone ?? context.timeZone);

  const payload: Record<string, unknown> = {
    empresaRuc: organization.ruc,
    tipoDoc: sale.document_type,
    serie: sale.series,
    correlativo: String(sale.correlative),
    tipoMoneda: sale.currency,
    fechaEmision: businessDate,
    tipoOperacion: "0101",
    establecimientoCodigo: branch.sunat_establishment_code ?? "0000",
    detalle: items.map((item) => {
      const quantity = Number(item.quantity);
      const lineSubtotal = Number(item.line_subtotal);
      const lineIgv = Number(item.line_igv);
      const lineTotal = Number(item.line_total);
      return buildIntifactDetailItem({
        productCode: item.product_code,
        sunatProductCode: item.sunat_product_code,
        description: item.description,
        unitCode: item.unit_code,
        affectation: item.tax_affectation_code,
        quantity,
        lineSubtotal,
        lineIgv,
        lineTotal,
      });
    }),
    montoOperGravadas: Number(computeData.montoOperGravadas ?? gravadas),
    montoOperExoneradas: Number(computeData.montoOperExoneradas ?? exoneradas),
    montoOperInafectas: Number(computeData.montoOperInafectas ?? inafectas),
    montoOperGratuitas: 0,
    montoIgv: Number(computeData.montoIgv ?? igv),
    totalImpuestos: Number(computeData.totalImpuestos ?? igv),
    valorVenta: Number(computeData.valorVenta ?? valorVenta),
    subTotal: Number(computeData.subTotal ?? total),
    montoImpVenta: Number(computeData.montoImpVenta ?? total),
    leyendas: [
      {
        legendCode: "1000",
        legendValue:
          typeof computeData.montoEnLetras === "string"
            ? computeData.montoEnLetras
            : `${total.toFixed(2)} SOLES`,
      },
    ],
    formaPago: [{ tipo: "Contado", monto: total, fechaPago: businessDate }],
  };

  if (sale.customer_document_type && sale.customer_document_number && sale.customer_name) {
    Object.assign(payload, {
      clienteTipoDoc: sale.customer_document_type,
      clienteNumDoc: sale.customer_document_number,
      clienteRazonSocial: sale.customer_name,
      ...(customerResult.data?.address
        ? { clienteDireccion: customerResult.data.address }
        : {}),
    });
  }

  const payloadHash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  const admin = createAdminClient();
  const attemptAt = new Date().toISOString();

  await admin
    .from("sales")
    .update({
      intifact_payload_hash: payloadHash,
      intifact_last_attempt_at: attemptAt,
      intifact_attempt_count: 1,
      intifact_error_message: null,
    })
    .eq("id", saleId);

  try {
    const sent = await sendInvoice(payload);

    await admin
      .from("sales")
      .update({
        status: mapIntifactStatus(sent.estado),
        intifact_document_id: sent.id,
        intifact_status: sent.estado,
        intifact_hash: sent.hash ?? null,
        intifact_payload_hash: payloadHash,
        intifact_last_attempt_at: attemptAt,
        intifact_last_checked_at: attemptAt,
        intifact_error_message: null,
        issued_at: attemptAt,
      })
      .eq("id", saleId);

    return {
      documentId: sent.id,
      intifactStatus: sent.estado,
      localStatus: mapIntifactStatus(sent.estado),
    };
  } catch (error) {
    const message =
      error instanceof IntifactApiError
        ? `${error.message}${error.status === 409 ? " El comprobante ya puede estar en proceso; no genere otro correlativo." : ""}`
        : error instanceof Error
          ? error.message
          : "Error desconocido al enviar a Intifact.";

    await admin
      .from("sales")
      .update({
        status: "error",
        intifact_error_message: message,
        intifact_last_attempt_at: attemptAt,
      })
      .eq("id", saleId);

    throw error;
  }
}

export function mapIntifactStatus(status: string) {
  switch (status.toUpperCase()) {
    case "ENCOLADO":
      return "queued";
    case "ENVIANDO":
    case "PENDIENTE":
      return "processing";
    case "ACEPTADO":
      return "accepted";
    case "RECHAZADO":
      return "rejected";
    case "COLA_FALLIDA":
      return "queue_failed";
    case "ANULADO":
      return "voided";
    default:
      return "processing";
  }
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}


export function buildIntifactDetailItem(input: {
  productCode: string;
  sunatProductCode: string | null;
  description: string;
  unitCode: string;
  affectation: "10" | "20" | "30";
  quantity: number;
  lineSubtotal: number;
  lineIgv: number;
  lineTotal: number;
}) {
  const {
    productCode,
    sunatProductCode,
    description,
    unitCode,
    affectation,
    quantity,
    lineSubtotal,
    lineIgv,
    lineTotal,
  } = input;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Cantidad inválida al construir el detalle fiscal.");
  }

  // SUNAT exige TaxSubtotal por cada línea gravada, exonerada o inafecta.
  // Para 20/30 el impuesto es 0, pero la base NO es 0: es el valor de venta
  // de la línea. Si mandamos base 0, Intifact puede omitir el tributo del XML
  // y SUNAT rechaza con 3105.
  return {
    unidad: unitCode,
    cantidad: quantity,
    codProducto: productCode,
    ...(sunatProductCode ? { codProdSunat: sunatProductCode } : {}),
    descripcion: description,
    montoValorUnitario: round(lineSubtotal / quantity, 6),
    montoBaseIgv: round(lineSubtotal),
    porcentajeIgv: affectation === "10" ? 18 : 0,
    igv: round(lineIgv),
    tipAfeIgv: affectation,
    totalImpuestos: round(lineIgv),
    montoPrecioUnitario: round(lineTotal / quantity, 6),
    montoValorVenta: round(lineSubtotal),
  };
}
