import { describe, expect, it } from "vitest";

import { buildIntifactDetailItem } from "./intifact-emission";

describe("buildIntifactDetailItem", () => {
  it("mantiene base imponible para una línea gravada", () => {
    const item = buildIntifactDetailItem({
      productId: "p1",
      description: "Producto gravado",
      unitCode: "NIU",
      affectation: "10",
      quantity: 1,
      lineSubtotal: 100,
      lineIgv: 18,
      lineTotal: 118,
    });

    expect(item.montoBaseIgv).toBe(100);
    expect(item.porcentajeIgv).toBe(18);
    expect(item.igv).toBe(18);
    expect(item.tipAfeIgv).toBe("10");
  });

  it("mantiene base positiva para una línea exonerada aunque IGV sea cero", () => {
    const item = buildIntifactDetailItem({
      productId: "p2",
      description: "Producto exonerado",
      unitCode: "NIU",
      affectation: "20",
      quantity: 1,
      lineSubtotal: 25,
      lineIgv: 0,
      lineTotal: 25,
    });

    expect(item.montoBaseIgv).toBe(25);
    expect(item.porcentajeIgv).toBe(0);
    expect(item.igv).toBe(0);
    expect(item.totalImpuestos).toBe(0);
    expect(item.tipAfeIgv).toBe("20");
  });

  it("mantiene base positiva para una línea inafecta aunque IGV sea cero", () => {
    const item = buildIntifactDetailItem({
      productId: "p3",
      description: "Producto inafecto",
      unitCode: "NIU",
      affectation: "30",
      quantity: 2,
      lineSubtotal: 25,
      lineIgv: 0,
      lineTotal: 25,
    });

    expect(item.montoBaseIgv).toBe(25);
    expect(item.porcentajeIgv).toBe(0);
    expect(item.tipAfeIgv).toBe("30");
    expect(item.montoValorUnitario).toBe(12.5);
  });
});
