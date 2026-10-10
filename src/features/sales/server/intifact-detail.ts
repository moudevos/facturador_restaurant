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

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
