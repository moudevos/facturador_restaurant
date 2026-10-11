import { describe, expect, it } from "vitest";

import { buildFullCreditNotePayload, type CreditNoteSource } from "./build-credit-note";

const sale: CreditNoteSource = {
  documentType: "03",
  series: "B001",
  correlative: 8,
  currency: "PEN",
  status: "accepted",
  commercialStatus: "completed",
  customerId: null,
  customerDocumentType: null,
  customerDocumentNumber: null,
  customerName: "CLIENTE VARIOS",
  customerAddress: null,
  totalAmount: 118,
  items: [{
    productCode: "P001",
    sunatProductCode: null,
    description: "Hamburguesa",
    unitCode: "NIU",
    taxAffectationCode: "10",
    quantity: 1,
    lineSubtotal: 100,
    lineIgv: 18,
    lineTotal: 118,
  }],
};

const common = {
  issuerRuc: "20100000001",
  noteSeries: "BC01",
  noteCorrelative: 1,
  fiscalIssueDate: "2026-10-11",
  establishmentCode: "0000",
  reason: "01" as const,
  amountInWords: "CIENTO DIECIOCHO CON 00/100 SOLES",
  sale,
};

describe("Full note of credit", () => {
  it("references the accepted boleta and never invents a generic buyer DNI", () => {
    const payload = buildFullCreditNotePayload(common);
    expect(payload.tipoDoc).toBe("07");
    expect(payload.afectadoTipoDoc).toBe("03");
    expect(payload.afectadoNumDoc).toBe("B001-8");
    expect(payload.montoImpVenta).toBe(118);
    expect(payload.montoIgv).toBe(18);
    expect(payload.clienteRazonSocial).toBe("CLIENTE VARIOS");
    expect(payload).not.toHaveProperty("clienteNumDoc");
  });

  it("requires FC series for an affected factura", () => {
    const factura: CreditNoteSource = {
      ...sale,
      documentType: "01",
      series: "F001",
      customerId: "buyer1",
      customerDocumentType: "6",
      customerDocumentNumber: "20100012345",
      customerName: "COMPRADOR S.A.C.",
    };
    expect(() => buildFullCreditNotePayload({ ...common, sale: factura }))
      .toThrow("FC");
    const payload = buildFullCreditNotePayload({ ...common, sale: factura, noteSeries: "FC01" });
    expect(payload.clienteNumDoc).toBe("20100012345");
  });

  it("blocks inconsistent original amounts", () => {
    expect(() => buildFullCreditNotePayload({
      ...common,
      sale: { ...sale, totalAmount: 119 },
    })).toThrow("no se emite");
  });
});
