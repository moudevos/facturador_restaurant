"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  MessageCircle,
  Printer,
  TriangleAlert,
} from "lucide-react";

import { Modal } from "@/components/modal";
import { useFeedback } from "@/components/feedback";
import { formatMoney } from "../utils/format";

type FiscalSaleResult = {
  saleId: string;
  series: string;
  correlative: number;
  totalAmount: number;
  changeAmount: number;
  fiscalStatus: string;
  intifactDocumentId: string | null;
  pdfReady: boolean;
  fiscalMessage: string | null;
};

type FiscalStatusResponse = {
  saleId: string;
  status: string;
  intifactStatus: string | null;
  intifactDocumentId: string | null;
  pdfReady: boolean;
  sunatCode: string | null;
  sunatDescription: string | null;
  errorMessage: string | null;
};

type PdfFormat = "a4" | "ticket80" | "ticket58";

const POLL_DELAYS = [5_000, 10_000, 20_000, 40_000];

export function SaleCompleteModal({
  sale,
  onNewSale,
}: {
  sale: FiscalSaleResult | null;
  onNewSale: () => void;
}) {
  const { toast } = useFeedback();
  const [status, setStatus] = useState<FiscalStatusResponse | null>(null);
  const [format, setFormat] = useState<PdfFormat>("ticket58");
  const [sharing, setSharing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sale) {
      setStatus(null);
      return;
    }

    setStatus({
      saleId: sale.saleId,
      status: sale.fiscalStatus,
      intifactStatus: sale.intifactDocumentId ? "ENCOLADO" : null,
      intifactDocumentId: sale.intifactDocumentId,
      pdfReady: sale.pdfReady,
      sunatCode: null,
      sunatDescription: null,
      errorMessage: sale.fiscalMessage,
    });
  }, [sale]);

  useEffect(() => {
    if (!sale || !status?.intifactDocumentId) return;
    if (isTerminal(status.status)) return;

    const saleId = sale.saleId;
    let cancelled = false;
    let attempt = 0;

    async function poll() {
      try {
        const response = await fetch(
          `/api/intifact/sales/${encodeURIComponent(saleId)}/status`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as FiscalStatusResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo consultar Intifact.");
        }

        if (cancelled) return;
        setStatus(payload);

        if (!isTerminal(payload.status) && attempt < POLL_DELAYS.length - 1) {
          attempt += 1;
          timerRef.current = setTimeout(poll, POLL_DELAYS[attempt]);
        }
      } catch (error) {
        if (cancelled) return;
        if (attempt < POLL_DELAYS.length - 1) {
          attempt += 1;
          timerRef.current = setTimeout(poll, POLL_DELAYS[attempt]);
        } else {
          setStatus((current) =>
            current
              ? {
                  ...current,
                  errorMessage:
                    error instanceof Error
                      ? error.message
                      : "No se pudo actualizar el estado fiscal.",
                }
              : current,
          );
        }
      }
    }

    timerRef.current = setTimeout(poll, POLL_DELAYS[0]);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sale, status?.intifactDocumentId, status?.status]);

  const number = sale
    ? `${sale.series}-${String(sale.correlative).padStart(8, "0")}`
    : "";

  const pdfReady = Boolean(status?.pdfReady);
  const pdfUrl = useMemo(() => {
    if (!sale) return "";
    return `/api/intifact/sales/${encodeURIComponent(sale.saleId)}/pdf?format=${format}`;
  }, [format, sale]);

  function openPdf() {
    if (!pdfReady || !pdfUrl) return;
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  async function sharePdf() {
    if (!sale || !pdfReady || !pdfUrl || sharing) return;
    setSharing(true);

    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "No se pudo preparar el PDF.");
      }

      const blob = await response.blob();
      const filename = `${number}-${format}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });

      if (
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: `Comprobante ${number}`,
          text: `Comprobante electrónico ${number}`,
          files: [file],
        });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      toast.info("El PDF fue descargado. Adjunta el archivo en WhatsApp.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(
        error instanceof Error ? error.message : "No se pudo compartir el comprobante.",
      );
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal
      open={Boolean(sale)}
      onClose={() => undefined}
      dismissible={false}
      title={status?.status === "accepted" ? "Venta completada" : "Venta registrada"}
      description={number || undefined}
      icon={status?.status === "accepted" ? CheckCircle2 : FileText}
      size="md"
    >
      {sale ? (
        <div className="space-y-4">
          <div className="rounded-[18px] bg-[#14201b] p-4 text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#9fb0a8]">
              Total cobrado
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="erp-mono text-[28px] font-bold tracking-[-0.03em] text-orange-400">
                {formatMoney(sale.totalAmount)}
              </p>
              {sale.changeAmount > 0 ? (
                <p className="text-right text-xs text-[#b6c4be]">
                  Vuelto
                  <span className="erp-mono ml-1 font-bold text-white">
                    {formatMoney(sale.changeAmount)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          <FiscalState status={status} />

          {pdfReady ? (
            <div className="rounded-[18px] border border-[#e8e3d7] bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
                Formato del comprobante
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([
                  ["a4", "A4"],
                  ["ticket80", "80 mm"],
                  ["ticket58", "58 mm"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormat(value)}
                    className={`h-11 rounded-[13px] border-[1.5px] text-xs font-extrabold transition ${
                      format === value
                        ? "border-orange-500 bg-[#fff0e2] text-[#e86400]"
                        : "border-[#e8e3d7] bg-white text-[#14201b]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-[#7b8680]">
                Intifact ofrece A4, ticket 80 mm y ticket 58 mm. El formato térmico más compacto disponible es 58 mm.
              </p>

              <div className="mt-4 overflow-hidden rounded-[14px] border border-[#e8e3d7] bg-[#f6f3ec]">
                <div className="flex items-center justify-between border-b border-[#e8e3d7] bg-white px-3 py-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
                    Vista previa PDF
                  </span>
                  <span className="rounded-full bg-[#fff0e2] px-2 py-1 text-[9px] font-extrabold text-orange-700">
                    {format === "a4" ? "A4" : format === "ticket80" ? "80 mm" : "58 mm"}
                  </span>
                </div>
                <iframe
                  key={pdfUrl}
                  title={`Vista previa del comprobante ${number}`}
                  src={pdfUrl}
                  className="h-[380px] w-full bg-white sm:h-[460px]"
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openPdf}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] border border-[#e8e3d7] bg-white text-sm font-extrabold text-[#14201b]"
                >
                  <Printer className="size-4" />
                  Ver / imprimir PDF
                </button>
                <button
                  type="button"
                  onClick={() => void sharePdf()}
                  disabled={sharing}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] bg-emerald-600 text-sm font-extrabold text-white disabled:opacity-60"
                >
                  <MessageCircle className="size-4" />
                  {sharing ? "Preparando..." : "Enviar por WhatsApp"}
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onNewSale}
            className="h-[52px] w-full rounded-[16px] bg-orange-500 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_#e86400]"
          >
            Nueva venta
          </button>
        </div>
      ) : null}
    </Modal>
  );
}

function FiscalState({ status }: { status: FiscalStatusResponse | null }) {
  if (!status) return null;

  if (status.status === "accepted") {
    return (
      <div className="flex items-start gap-3 rounded-[16px] bg-[#dff5e9] p-3.5 text-[#176b45]">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-extrabold">Aceptado por SUNAT</p>
          <p className="mt-0.5 text-xs leading-relaxed">
            El comprobante oficial ya está disponible para imprimir o compartir.
          </p>
        </div>
      </div>
    );
  }

  if (status.status === "rejected" || status.status === "queue_failed" || status.status === "error") {
    return (
      <div className="flex items-start gap-3 rounded-[16px] bg-[#fde8e8] p-3.5 text-[#a93232]">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-extrabold">
            {status.status === "rejected" ? "Comprobante rechazado" : "Emisión requiere revisión"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed">
            {status.errorMessage ||
              status.sunatDescription ||
              "La venta quedó cobrada. No generes otro correlativo para la misma operación."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-[16px] bg-blue-50 p-3.5 text-blue-800">
      <Clock3 className="mt-0.5 size-5 shrink-0 animate-pulse" />
      <div>
        <p className="text-sm font-extrabold">Procesando con Intifact / SUNAT</p>
        <p className="mt-0.5 text-xs leading-relaxed">
          Estado: {status.intifactStatus || "ENCOLADO"}. Puedes continuar vendiendo; el estado se consulta por polling porque este plan no usa webhooks.
        </p>
      </div>
    </div>
  );
}

function isTerminal(status: string) {
  return ["accepted", "rejected", "queue_failed", "voided", "error"].includes(status);
}
