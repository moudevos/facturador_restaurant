export const TAX_AFFECTATION_LABELS = { "10": "Gravado", "20": "Exonerado", "30": "Inafecto" } as const;
export function formatProductPrice(value: string | number) { return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 }).format(Number(value)); }
