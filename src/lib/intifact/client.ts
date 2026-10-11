import type {
  IntifactComputeData,
  IntifactComputeRequest,
  IntifactDocumentSnapshot,
  IntifactEnvelope,
  IntifactPdfFormat,
  IntifactSendData,
} from "./types";

const DEFAULT_BASE_URL = "https://api-facturacion.intifact.com";

export class IntifactApiError extends Error {
  status: number;
  payload: unknown;
  retryAfter: string | null;

  constructor(message: string, status: number, payload: unknown, retryAfter: string | null) {
    super(message);
    this.name = "IntifactApiError";
    this.status = status;
    this.payload = payload;
    this.retryAfter = retryAfter;
  }
}

export function assertIntifactConfigured() {
  if (!process.env.INTIFACT_API_KEY) {
    throw new Error("Falta INTIFACT_API_KEY en el entorno del servidor.");
  }
}

function config() {
  assertIntifactConfigured();

  return {
    baseUrl: (process.env.INTIFACT_API_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    apiKey: process.env.INTIFACT_API_KEY!,
  };
}

async function request(path: string, init: RequestInit = {}) {
  const { baseUrl, apiKey } = config();

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  return response;
}

/**
 * Include field-level validation details when the provider supplies them.
 * The generic "Error de validación" alone is not actionable in the POS.
 */
export function describeIntifactError(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") {
    return typeof payload === "string" && payload.trim()
      ? payload.slice(0, 700)
      : `Intifact respondió HTTP ${status}.`;
  }

  const row = payload as Record<string, unknown>;
  const errorObject =
    row.error && typeof row.error === "object"
      ? (row.error as Record<string, unknown>)
      : null;

  const primary =
    [row.message, row.error, errorObject?.message]
      .find((value) => typeof value === "string" && value.trim()) as string | undefined;

  function flatten(value: unknown): string[] {
    if (typeof value === "string") return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (!value || typeof value !== "object") return [];

    const fields = value as Record<string, unknown>;
    if (typeof fields.message === "string") {
      const field =
        typeof fields.path === "string"
          ? fields.path
          : typeof fields.field === "string"
            ? fields.field
            : "";
      return [field ? `${field}: ${fields.message}` : fields.message];
    }

    return Object.entries(fields).flatMap(([key, item]) =>
      flatten(item).map((message) => `${key}: ${message}`),
    );
  }

  const details = [
    row.errors,
    row.details,
    row.issues,
    errorObject?.errors,
    errorObject?.details,
  ].flatMap(flatten).filter((detail) => detail !== primary);

  return [primary || `Intifact respondió HTTP ${status}.`, ...new Set(details)]
    .join(" — ")
    .slice(0, 700);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await request(path, init);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = describeIntifactError(payload, response.status);

    throw new IntifactApiError(
      message,
      response.status,
      payload,
      response.headers.get("retry-after"),
    );
  }

  return payload as T;
}

export async function computeInvoice(body: IntifactComputeRequest) {
  const response = await requestJson<IntifactEnvelope<IntifactComputeData>>(
    "/api/v1/invoice/compute",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return response.data;
}

export async function sendInvoice(body: Record<string, unknown>) {
  const response = await requestJson<IntifactEnvelope<IntifactSendData>>(
    "/api/v1/invoice/send",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return response.data;
}

export async function getDocument(documentId: string): Promise<IntifactDocumentSnapshot> {
  const response = await requestJson<IntifactEnvelope<Record<string, unknown>>>(
    `/api/v1/documents/${encodeURIComponent(documentId)}`,
  );

  const data = response.data ?? {};
  const sunat =
    typeof data.sunat === "object" && data.sunat !== null
      ? (data.sunat as Record<string, unknown>)
      : {};

  const estado =
    (typeof sunat.estado === "string" && sunat.estado) ||
    (typeof data.estado === "string" && data.estado) ||
    "PENDIENTE";

  const sunatCode =
    (typeof sunat.codigo === "string" && sunat.codigo) ||
    (typeof sunat.code === "string" && sunat.code) ||
    null;

  const sunatDescription =
    (typeof sunat.descripcion === "string" && sunat.descripcion) ||
    (typeof sunat.description === "string" && sunat.description) ||
    null;

  return {
    estado,
    sunatCode,
    sunatDescription,
    raw: response,
  };
}

export async function retryDocument(documentId: string) {
  return requestJson<IntifactEnvelope<Record<string, unknown>>>(
    `/api/v1/documents/${encodeURIComponent(documentId)}/retry`,
    { method: "POST" },
  );
}

export async function getInvoicePdf(
  documentId: string,
  format: IntifactPdfFormat,
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const response = await request(
    `/api/v1/invoice/${encodeURIComponent(documentId)}/pdf?format=${encodeURIComponent(format)}`,
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new IntifactApiError(
      `No se pudo descargar el PDF de Intifact (HTTP ${response.status}).`,
      response.status,
      payload,
      response.headers.get("retry-after"),
    );
  }

  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "application/pdf",
  };
}


async function getInvoiceArtifact(
  documentId: string,
  kind: "xml" | "cdr",
): Promise<{ bytes: ArrayBuffer; contentType: string; contentDisposition: string | null }> {
  const response = await request(
    `/api/v1/invoice/${encodeURIComponent(documentId)}/${kind}`,
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new IntifactApiError(
      `No se pudo descargar ${kind.toUpperCase()} de Intifact (HTTP ${response.status}).`,
      response.status,
      payload,
      response.headers.get("retry-after"),
    );
  }

  return {
    bytes: await response.arrayBuffer(),
    contentType:
      response.headers.get("content-type") ||
      (kind === "xml" ? "application/xml" : "application/zip"),
    contentDisposition: response.headers.get("content-disposition"),
  };
}

export function getInvoiceXml(documentId: string) {
  return getInvoiceArtifact(documentId, "xml");
}

export function getInvoiceCdr(documentId: string) {
  return getInvoiceArtifact(documentId, "cdr");
}


export type IntifactCompany = {
  id: string;
  ruc: string;
  razonSocial: string | null;
};

export type IntifactCompanyBranch = {
  id: string | null;
  codigo: string;
  nombre: string | null;
  direccion: string | null;
  ubigeo: string | null;
  active: boolean;
};

function rowsFromUnknownData(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  const row = value as Record<string, unknown>;
  for (const key of ["items", "companies", "branches", "data"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }

  return [];
}

export async function listCompanies(): Promise<IntifactCompany[]> {
  const response = await requestJson<IntifactEnvelope<unknown>>(
    "/api/v1/companies",
  );

  return rowsFromUnknownData(response.data).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;

    const id =
      typeof row.id === "string"
        ? row.id
        : typeof row.companyId === "string"
          ? row.companyId
          : null;
    const ruc = typeof row.ruc === "string" ? row.ruc : null;

    if (!id || !ruc) return [];

    const razonSocial =
      typeof row.razonSocial === "string"
        ? row.razonSocial
        : typeof row.razon_social === "string"
          ? row.razon_social
          : typeof row.legalName === "string"
            ? row.legalName
            : null;

    return [{ id, ruc, razonSocial }];
  });
}

/**
 * Checks the logo configured in Intifact's issuer portal. This is different
 * from the organization's receipt logo stored in Supabase.
 */
export async function hasIntifactCompanyLogo(companyId: string): Promise<boolean> {
  const response = await request(
    `/api/v1/companies/${encodeURIComponent(companyId)}/logo`,
  );
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new IntifactApiError(
      `No se pudo consultar el logo de Intifact (HTTP ${response.status}).`,
      response.status,
      null,
      response.headers.get("retry-after"),
    );
  }
  return true;
}

export async function listCompanyBranches(
  companyId: string,
): Promise<IntifactCompanyBranch[]> {
  const response = await requestJson<IntifactEnvelope<unknown>>(
    `/api/v1/companies/${encodeURIComponent(companyId)}/branches`,
  );

  return rowsFromUnknownData(response.data).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;

    const codigo =
      typeof row.codigo === "string"
        ? row.codigo
        : typeof row.code === "string"
          ? row.code
          : null;

    if (!codigo) return [];

    return [{
      id: typeof row.id === "string" ? row.id : null,
      codigo,
      nombre:
        typeof row.nombre === "string"
          ? row.nombre
          : typeof row.name === "string"
            ? row.name
            : null,
      direccion:
        typeof row.direccion === "string"
          ? row.direccion
          : typeof row.address === "string"
            ? row.address
            : null,
      ubigeo: typeof row.ubigeo === "string" ? row.ubigeo : null,
      active:
        row.active === false || row.isActive === false
          ? false
          : true,
    }];
  });
}

export async function findDocumentByFiscalIdentity(input: {
  ruc: string;
  documentType: string;
  series: string;
  correlative: number | string;
}): Promise<{ id: string; estado: string } | null> {
  const params = new URLSearchParams({
    ruc: input.ruc,
    tipoDoc: input.documentType,
    serie: input.series,
    limit: "100",
  });

  const expectedCorrelative = String(input.correlative).replace(/^0+/, "") || "0";
  const maxPages = 50;

  for (let page = 1; page <= maxPages; page += 1) {
    params.set("page", String(page));
    const response = await requestJson<
      IntifactEnvelope<unknown> & {
        pagination?: { totalPages?: number };
      }
    >(`/api/v1/documents?${params.toString()}`);

    if (!Array.isArray(response.data)) {
      throw new Error(
        "Intifact devolvió un listado de documentos inesperado. No es seguro reemitir.",
      );
    }

    for (const value of response.data) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      const estado =
        typeof row.estadoSunat === "string"
          ? row.estadoSunat
          : typeof row.estado === "string"
            ? row.estado
            : "PENDIENTE";
      const correlative =
        typeof row.correlativo === "string" || typeof row.correlativo === "number"
          ? String(row.correlativo).replace(/^0+/, "") || "0"
          : null;

      // Defensive checks in addition to the RUC/type/series API filters.
      if (row.tipoDoc && row.tipoDoc !== input.documentType) continue;
      if (row.serie && row.serie !== input.series) continue;
      const company =
        row.company && typeof row.company === "object"
          ? (row.company as Record<string, unknown>)
          : null;
      if (company?.ruc && company.ruc !== input.ruc) continue;

      if (id && correlative === expectedCorrelative) {
        return { id, estado };
      }
    }

    const totalPages = response.pagination?.totalPages;
    if (typeof totalPages === "number" && Number.isFinite(totalPages)) {
      if (page >= totalPages) return null;
    } else if (response.data.length < 100) {
      return null;
    }
  }

  // Avoid a false "not found" after hitting a scan limit: the caller must
  // not issue another POST until the identity has been reconciled.
  throw new Error(
    "El historial de Intifact supera el límite de conciliación. No se reintentó la emisión.",
  );
}
