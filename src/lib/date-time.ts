export const DEFAULT_BUSINESS_TIME_ZONE = "America/Lima";
export const DEFAULT_LOCALE = "es-PE";

type DateInput = Date | string | number;

function toValidDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Fecha inválida.");
  }

  return date;
}

export function formatBusinessDateTime(
  value: DateInput,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
  }).format(toValidDate(value));
}

export function formatBusinessDate(
  value: DateInput,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    timeZone,
    dateStyle: "short",
  }).format(toValidDate(value));
}

export function getBusinessDateISO(
  value: DateInput,
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toValidDate(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("No se pudo calcular la fecha de negocio.");
  }

  return `${year}-${month}-${day}`;
}
