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
