import { buildIntifactCustomerFields } from "../../sales/server/intifact-customer";
import { buildIntifactDetailItem } from "../../sales/server/intifact-detail";

export type FullCreditNoteReason = "01" | "06";

export type CreditNoteSource = {
  documentType: "01" | "03";
  series: string;
  correlative: number;
  currency: "PEN";
  status: "accepted";
  commercialStatus: "completed";
  customerId: string | null;
  customerDocumentType: string | null;
  customerDocumentNumber: string | null;
  customerName: string | null;
  customerAddress: string | null;
  totalAmount: number;
  items: Array<{
    productCode: string;
    sunatProductCode: string | null;
    description: string;
    unitCode: string;
    taxAffectationCode: "10" | "20" | "30";
    quantity: number;
    lineSubtotal: number;
    lineIgv: number;
    lineTotal: number;
  }>;
};

export type FullCreditNoteInput = {
  issuerRuc: string;
  noteSeries: string;
  noteCorrelative: number;
  fiscalIssueDate: string;
  establishmentCode: string;
  reason: FullCreditNoteReason;
  amountInWords: string;
  sale: CreditNoteSource;
};

/**
 * Builds only FULL reversal credit notes (01 annulment / 06 full return).
 * Partial discounts/returns need explicit product and amount allocation and
 * must not be silently represented by a full note.
 */
export function buildFullCreditNotePayload(input: FullCreditNoteInput) {
  const sale = input.sale;
  if (sale.status !== "accepted" || sale.commercialStatus !== "completed") {
    throw new Error("Solo un comprobante aceptado y una venta completada admiten NC.");
  }
  const expectedSeriesPrefix = sale.documentType === "01" ? "FC" : "BC";

  if (!/^\d{11}$/.test(input.issuerRuc)) throw new Error("RUC emisor inválido.");
  if (!new RegExp(`^${expectedSeriesPrefix}[A-Z0-9]{2}$`).test(input.noteSeries)) {
    throw new Error(`La NC debe usar una serie ${expectedSeriesPrefix}##.`);
  }
  if (!Number.isSafeInteger(input.noteCorrelative) || input.noteCorrelative <= 0) {
    throw new Error("Correlativo de nota inválido.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fiscalIssueDate)) {
    throw new Error("Fecha fiscal de nota inválida.");
  }
  if (!/^\d{4}$/.test(input.establishmentCode)) {
    throw new Error("Código SUNAT de establecimiento inválido.");
  }
  if (!sale.items.length || !input.amountInWords.trim()) {
    throw new Error("La nota requiere ítems e importe en letras.");
  }
  if (sale.documentType === "01" && sale.customerDocumentType !== "6") {
    throw new Error("La factura original debe conservar el RUC del cliente.");
  }

  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const total = round(sale.items.reduce((n, item) => n + item.lineTotal, 0));
  if (!Number.isFinite(total) || total <= 0 || Math.abs(total - sale.totalAmount) > 0.02) {
    throw new Error("Los importes originales no cuadran: no se emite la NC.");
  }

  const taxable = round(sale.items.filter((x) => x.taxAffectationCode === "10")
    .reduce((n, x) => n + x.lineSubtotal, 0));
  const exempt = round(sale.items.filter((x) => x.taxAffectationCode === "20")
    .reduce((n, x) => n + x.lineSubtotal, 0));
  const unaffected = round(sale.items.filter((x) => x.taxAffectationCode === "30")
    .reduce((n, x) => n + x.lineSubtotal, 0));
  const igv = round(sale.items.reduce((n, x) => n + x.lineIgv, 0));
  const subtotal = round(taxable + exempt + unaffected);

  return {
    empresaRuc: input.issuerRuc,
    tipoDoc: "07" as const,
    serie: input.noteSeries,
    correlativo: String(input.noteCorrelative),
    tipoMoneda: "PEN" as const,
    fechaEmision: input.fiscalIssueDate,
    tipoOperacion: "0101",
    establecimientoCodigo: input.establishmentCode,
    ...buildIntifactCustomerFields({
      customerId: sale.customerId,
      documentType: sale.customerDocumentType,
      documentNumber: sale.customerDocumentNumber,
      name: sale.customerName,
      address: sale.customerAddress,
    }),
    afectadoTipoDoc: sale.documentType,
    afectadoNumDoc: `${sale.series}-${sale.correlative}`,
    motivoCod: input.reason,
    motivoDes: input.reason === "01" ? "ANULACION DE LA OPERACION" : "DEVOLUCION TOTAL",
    detalle: sale.items.map((item) =>
      buildIntifactDetailItem({
        productCode: item.productCode,
        sunatProductCode: item.sunatProductCode,
        description: item.description,
        unitCode: item.unitCode,
        affectation: item.taxAffectationCode,
        quantity: item.quantity,
        lineSubtotal: item.lineSubtotal,
        lineIgv: item.lineIgv,
        lineTotal: item.lineTotal,
      }),
    ),
    montoOperGravadas: taxable,
    montoOperExoneradas: exempt,
    montoOperInafectas: unaffected,
    montoOperGratuitas: 0,
    montoIgv: igv,
    totalImpuestos: igv,
    valorVenta: subtotal,
    subTotal: total,
    montoImpVenta: total,
    leyendas: [{ legendCode: "1000", legendValue: input.amountInWords.trim() }],
  };
}
