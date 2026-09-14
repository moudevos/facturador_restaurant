const PEN_FORMATTER = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export function formatCurrency(value: number) {
  return PEN_FORMATTER.format(value);
}

export function calculateSimpleResult(income: number, expenses: number) {
  return income - expenses;
}
