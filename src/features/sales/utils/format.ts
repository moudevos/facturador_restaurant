export function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export function formatSessionDateTime(value: string, timeZone = "America/Lima") {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(value));
}

export function formatSessionTime(value: string, timeZone = "America/Lima") {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function sessionDuration(openedAt: string, closedAt?: string | null) {
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const start = new Date(openedAt).getTime();
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h ${String(rest).padStart(2, "0")} min`;
}

export function sessionCode(id: string) {
  return `S-${id.slice(0, 6).toUpperCase()}`;
}

export const PAYMENT_LABELS = {
  cash: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  card: "Tarjeta",
  transfer: "Transferencia",
} as const;
