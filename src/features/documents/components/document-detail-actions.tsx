"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, RotateCcw } from "lucide-react";

import { useFeedback } from "@/components/feedback";
import {
  retryFiscalDocumentAction,
  retryPendingEmissionAction,
  syncDocumentsAction,
} from "../server/actions";

export function DocumentDetailActions({
  saleId,
  status,
  commercialStatus,
  isOwner,
}: {
  saleId: string;
  status: string;
  commercialStatus: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { toast, confirm, withLoading } = useFeedback();

  const canSync =
    ["draft", "queued", "processing"].includes(status) ||
    (status === "error" && commercialStatus === "pending");
  const canRetry = isOwner && status === "queue_failed";
  const canRetryPending =
    isOwner && ["draft", "error"].includes(status) && commercialStatus === "pending";

  async function sync() {
    const result = await withLoading(() => syncDocumentsAction([saleId]), {
      title: "Consultando Intifact",
      message: "Actualizando el estado fiscal del comprobante...",
    });
    if (result.success) toast.success(result.message);
    else toast.warning(result.message);
    router.refresh();
  }

  async function retryPending() {
    const accepted = await confirm({
      title: "Reintentar emisión pendiente",
      description:
        "Primero se conciliará con Intifact. Solo si la consulta completa confirma que el documento no existe, se enviará con la misma serie, correlativo y fecha fiscal.",
      tone: "warning",
      confirmText: "Reintentar de forma segura",
      cancelText: "Cancelar",
    });

    if (!accepted) return;

    const result = await withLoading(
      () => retryPendingEmissionAction(saleId),
      {
        title: "Reintentando emisión",
        message:
          "Conservando exactamente la misma identidad fiscal...",
      },
    );

    if (result.success) toast.success(result.message);
    else toast.error(result.message);

    router.refresh();
  }

  async function retry() {
    const accepted = await confirm({
      title: "Reintentar emisión",
      description:
        "Se reencolará exactamente el mismo documento en Intifact. No se creará otro correlativo.",
      tone: "warning",
      confirmText: "Reintentar",
      cancelText: "Cancelar",
    });

    if (!accepted) return;

    const result = await withLoading(() => retryFiscalDocumentAction(saleId), {
      title: "Reencolando comprobante",
      message: "Conservando serie, correlativo y fecha fiscal...",
    });

    if (result.success) toast.success(result.message);
    else toast.error(result.message);
    router.refresh();
  }

  if (!canSync && !canRetry && !canRetryPending) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canSync ? (
        <button
          type="button"
          onClick={() => void sync()}
          className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#e8e3d7] bg-white px-4 text-sm font-extrabold text-[#14201b]"
        >
          <RefreshCw className="size-4" />
          Actualizar estado
        </button>
      ) : null}
      {canRetryPending ? (
        <button
          type="button"
          onClick={() => void retryPending()}
          className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-orange-500 px-4 text-sm font-extrabold text-white"
        >
          <RotateCcw className="size-4" />
          Reintentar emisión
        </button>
      ) : null}
      {canRetry ? (
        <button
          type="button"
          onClick={() => void retry()}
          className="inline-flex h-11 items-center gap-2 rounded-[14px] bg-red-600 px-4 text-sm font-extrabold text-white"
        >
          <RotateCcw className="size-4" />
          Reintentar cola
        </button>
      ) : null}
    </div>
  );
}
