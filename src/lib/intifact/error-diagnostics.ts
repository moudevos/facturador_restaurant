/**
 * Intifact response diagnostics. Never store the outbound document payload,
 * Authorization header, credentials or arbitrary HTTP response headers.
 */
const SECRET_FIELD = /authorization|access.?token|refresh.?token|api.?key|password|secret|cookie|private.?key|client.?secret/i;
const SECRET_VALUE = /(?:fact_(?:test|live)_[a-z0-9_-]+|bearer\s+[a-z0-9._-]+)/gi;

function redactText(value: string): string {
  return value.replace(SECRET_VALUE, "[REDACTED]");
}

function redactResponse(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[DEPTH_LIMIT]";
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => redactResponse(item, depth + 1));
  if (!value || typeof value !== "object") return String(value);

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SECRET_FIELD.test(key)
      ? "[REDACTED]"
      : redactResponse(item, depth + 1);
  }
  return result;
}

export type IntifactHttpDiagnostic = {
  httpStatus: number;
  requestId: string | null;
  response: unknown;
  truncated: boolean;
};

/** Preserves the entire error JSON in normal provider responses, up to 48 KiB. */
export function buildIntifactHttpDiagnostic(
  status: number,
  payload: unknown,
  requestId: string | null,
): IntifactHttpDiagnostic {
  const redacted = redactResponse(payload);
  const json = JSON.stringify(redacted);
  const maximumSize = 48 * 1024;

  return {
    httpStatus: status,
    requestId: requestId ? redactText(requestId).slice(0, 160) : null,
    response:
      json.length > maximumSize
        ? { preview: json.slice(0, maximumSize), note: "Respuesta demasiado extensa; recortada." }
        : redacted,
    truncated: json.length > maximumSize,
  };
}

function primaryMessage(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const messages = value.map(primaryMessage).filter((x): x is string => Boolean(x));
    return messages.length ? messages.join("; ") : null;
  }
  if (!value || typeof value !== "object") return null;

  const row = value as Record<string, unknown>;
  for (const field of ["message", "mensaje", "detail", "description", "descripcion"]) {
    const result = primaryMessage(row[field]);
    if (result) return result;
  }
  return null;
}

function fieldPath(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (Array.isArray(value)) return value.map(String).join(".") || null;
  return null;
}

function collectIssues(value: unknown, output: string[], prefix = "", depth = 0): void {
  if (depth > 8 || output.length >= 50) return;

  if (typeof value === "string") {
    if (value.trim()) output.push(prefix ? `${prefix}: ${value.trim()}` : value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectIssues(item, output, prefix, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;

  const row = value as Record<string, unknown>;
  const path = fieldPath(row.path) ?? fieldPath(row.field) ??
    fieldPath(row.property) ?? fieldPath(row.param) ?? prefix;
  const message = primaryMessage(row.message) ?? primaryMessage(row.msg);
  if (message) output.push(path ? `${path}: ${message}` : message);

  for (const [key, child] of Object.entries(row)) {
    if (/^(?:message|mensaje|msg|path|field|property|param|code|status|statusCode|timestamp|requestId)$/i.test(key)) {
      continue;
    }
    // Nested validation fields: e.g. errors.clienteTipoDoc = ["Campo requerido"].
    if (Array.isArray(child) || (child && typeof child === "object") || typeof child === "string") {
      const nestedPath = /^(?:errors|errores|details|detalles|issues|validationErrors|data)$/i.test(key)
        ? prefix
        : [prefix, key].filter(Boolean).join(".");
      collectIssues(child, output, nestedPath, depth + 1);
    }
  }
}

export function formatIntifactError(payload: unknown, status: number): string {
  const safe = redactResponse(payload);
  if (typeof safe === "string") {
    return `HTTP ${status} · ${safe.slice(0, 1800)}`;
  }
  if (!safe || typeof safe !== "object") return `Intifact respondió HTTP ${status}.`;

  const row = safe as Record<string, unknown>;
  const primary = primaryMessage(row.message) ??
    primaryMessage(row.mensaje) ??
    primaryMessage(row.error) ??
    `Intifact respondió HTTP ${status}`;
  const issues: string[] = [];
  for (const field of ["errors", "errores", "details", "detalles", "issues", "validationErrors"]) {
    collectIssues(row[field], issues);
  }
  if (row.error && typeof row.error === "object") {
    for (const field of ["errors", "details", "issues", "validationErrors"]) {
      collectIssues((row.error as Record<string, unknown>)[field], issues);
    }
  }
  if (row.data && typeof row.data === "object") {
    for (const field of ["errors", "details", "issues", "validationErrors"]) {
      collectIssues((row.data as Record<string, unknown>)[field], issues);
    }
  }
  const unique = [...new Set(issues.filter((x) => x !== primary))];
  return [`HTTP ${status} · ${primary}`, ...unique].join(" — ").slice(0, 1900);
}
