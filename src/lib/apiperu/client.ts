const DEFAULT_APIPERU_URL = "https://api.apiperu.dev";

type ApiPeruEnvelope<T> = {
  success: boolean;
  code: string;
  retryable: boolean;
  data?: T;
  message?: string;
  time?: number;
};

type DniData = {
  numero: string;
  nombre_completo: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  codigo_verificacion?: number;
};

type RucData = {
  ruc: string;
  nombre_o_razon_social: string;
  estado?: string;
  condicion?: string;
  direccion?: string;
  departamento?: string;
  es_agente_de_retencion?: string;
  es_buen_contribuyente?: string;
};

export type ApiPeruIdentityResult = {
  documentType: "1" | "6";
  documentNumber: string;
  name: string;
  address: string | null;
  taxpayerStatus: string | null;
  taxpayerCondition: string | null;
};

export class ApiPeruError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(
    message: string,
    status: number,
    code = "unknown_error",
    retryable = false,
  ) {
    super(message);
    this.name = "ApiPeruError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function config() {
  const token = process.env.APIPERU_API_TOKEN;
  if (!token) {
    throw new Error("Falta APIPERU_API_TOKEN en el entorno del servidor.");
  }

  return {
    baseUrl: (process.env.APIPERU_API_URL || DEFAULT_APIPERU_URL).replace(/\/$/, ""),
    token,
  };
}

async function post<T>(path: string, body: Record<string, string>) {
  const { baseUrl, token } = config();

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let payload: ApiPeruEnvelope<T>;
  try {
    payload = (await response.json()) as ApiPeruEnvelope<T>;
  } catch {
    throw new ApiPeruError(
      `ApiPeru respondió HTTP ${response.status} sin JSON válido.`,
      response.status,
    );
  }

  if (!response.ok || !payload.success || !payload.data) {
    throw new ApiPeruError(
      payload.message || `ApiPeru respondió HTTP ${response.status}.`,
      response.status,
      payload.code,
      payload.retryable,
    );
  }

  return payload.data;
}

export async function lookupIdentityDocument(
  documentNumber: string,
): Promise<ApiPeruIdentityResult> {
  const normalized = documentNumber.trim();

  if (/^\d{8}$/.test(normalized)) {
    const data = await post<DniData>("/dni", { dni: normalized });

    return {
      documentType: "1",
      documentNumber: data.numero,
      name: data.nombre_completo.trim(),
      address: null,
      taxpayerStatus: null,
      taxpayerCondition: null,
    };
  }

  if (/^\d{11}$/.test(normalized)) {
    const data = await post<RucData>("/ruc", { ruc: normalized });

    return {
      documentType: "6",
      documentNumber: data.ruc,
      name: data.nombre_o_razon_social.trim(),
      address: data.direccion?.trim() || null,
      taxpayerStatus: data.estado?.trim() || null,
      taxpayerCondition: data.condicion?.trim() || null,
    };
  }

  throw new ApiPeruError(
    "Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos.",
    400,
    "invalid_input",
    false,
  );
}
