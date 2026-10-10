"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, RotateCcw } from "lucide-react";

import { useFeedback } from "@/components/feedback";
import {
  retryFiscalDocumentAction,
  syncDocumentsAction,
} from "../server/actions";

export function DocumentDetailActions({
  saleId,
  status,
  isOwner,
}: {
  saleId: string;
  status: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { toast, confirm, withLoading } = useFeedback();

  const canSync = ["draft", "queued", "processing"].includes(status);
  const canRetry = isOwner && status === "queue_failed";

  async function sync() {
    const result = await withLoading(() => syncDocumentsAction([saleId]), {
      title: "Consultando Intifact",
      message: "Actualizando el estado fiscal del comprobante...",
    });
    if (result.success) toast.success(result.message);
    else toast.warning(result.message);
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

  if (!canSync && !canRetry) return null;

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
