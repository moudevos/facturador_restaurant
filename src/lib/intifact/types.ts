export type IntifactPdfFormat = "a4" | "ticket" | "ticket80" | "ticket58";

export type IntifactComputeItem = {
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  afectacion?: "10" | "20" | "30";
};

export type IntifactComputeRequest = {
  tipoMoneda: "PEN";
  preciosIncluyenIgv: true;
  items: IntifactComputeItem[];
};

export type IntifactComputeData = {
  items?: unknown[];
  montoOperGravadas?: number;
  montoOperExoneradas?: number;
  montoOperInafectas?: number;
  montoIgv?: number;
  totalImpuestos?: number;
  valorVenta?: number;
  subTotal?: number;
  montoImpVenta?: number;
  montoEnLetras?: string;
  [key: string]: unknown;
};

export type IntifactSendData = {
  id: string;
  estado: string;
  hash?: string;
  [key: string]: unknown;
};

export type IntifactEnvelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

export type IntifactDocumentSnapshot = {
  estado: string;
  sunatCode: string | null;
  sunatDescription: string | null;
  raw: unknown;
};
