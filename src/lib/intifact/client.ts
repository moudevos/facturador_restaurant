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

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await request(path, init);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : `Intifact respondió HTTP ${response.status}.`;

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
    page: "1",
    limit: "20",
  });

  const response = await requestJson<
    IntifactEnvelope<unknown> & { pagination?: unknown }
  >(`/api/v1/documents?${params.toString()}`);

  const expectedCorrelative = String(input.correlative).replace(/^0+/, "") || "0";

  for (const value of rowsFromUnknownData(response.data)) {
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

    if (id && correlative === expectedCorrelative) {
      return { id, estado };
    }
  }

  return null;
}
