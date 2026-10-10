"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { useFeedback } from "@/components/feedback";
import { formatBusinessDateOnly } from "@/lib/date-time";
import { formatMoney } from "@/features/sales/utils/format";
import {
  retryFiscalDocumentAction,
  syncDocumentsAction,
} from "../server/actions";
import { listDocumentsAction } from "../server/list-action";
import {
  DOCUMENTS_PER_PAGE,
  type DocumentFilters,
  type FiscalDocumentListItem,
} from "../types/document";
import {
  DOCUMENT_STATUS_LABELS,
  documentNumber,
  documentStatusClass,
  documentTypeLabel,
} from "../utils/document-format";

type DocumentsData = Awaited<ReturnType<typeof listDocumentsAction>>;

export function DocumentsManager({
  filters,
  isOwner,
  initialData,
}: {
  filters: DocumentFilters;
  isOwner: boolean;
  initialData: DocumentsData;
}) {
  const queryClient = useQueryClient();
  const { toast, withLoading } = useFeedback();

  const documentsQuery = useQuery({
    queryKey: ["documents", filters],
    queryFn: () => listDocumentsAction(filters),
    initialData,
  });

  const syncMutation = useMutation({
    mutationFn: async (saleIds: string[]) =>
      withLoading(() => syncDocumentsAction(saleIds), {
        title: "Actualizando estados",
        message: "Consultando Intifact sin generar nuevos correlativos...",
      }),
    onSuccess: async (result) => {
      if (result.success) toast.success(result.message);
      else toast.warning(result.message);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (saleId: string) =>
      withLoading(() => retryFiscalDocumentAction(saleId), {
        title: "Reencolando comprobante",
        message: "Se reutilizará la misma identidad fiscal.",
      }),
    onSuccess: async (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const data = documentsQuery.data;
  const pendingIds = data.documents
    .filter((document) =>
      ["draft", "queued", "processing"].includes(document.status),
    )
    .slice(0, 10)
    .map((document) => document.id);

  const totalPages = Math.max(1, Math.ceil(data.count / DOCUMENTS_PER_PAGE));

  function pageHref(page: number) {
    const params = new URLSearchParams({
      desde: filters.dateFrom,
      hasta: filters.dateTo,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.branchId ? { local: filters.branchId } : {}),
      ...(filters.documentType !== "all"
        ? { tipo: filters.documentType }
        : {}),
      ...(filters.status !== "all" ? { estado: filters.status } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    });
    return `/comprobantes?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <SummaryCard
          label="Comprobantes"
          value={String(data.summary.recordCount)}
          detail="En el filtro actual"
        />
        <SummaryCard
          label="Aceptados"
          value={formatMoney(data.summary.acceptedAmount)}
          detail={`${data.summary.acceptedCount} documentos`}
          tone="success"
        />
        <SummaryCard
          label="En proceso"
          value={String(data.summary.pendingCount)}
          detail="Pendiente / cola / envío"
          tone="info"
        />
        <SummaryCard
          label="Con incidencia"
          value={String(data.summary.issueCount)}
          detail="Rechazado / cola fallida / error"
          tone="danger"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[#7b8680]">
          {data.count} {data.count === 1 ? "comprobante" : "comprobantes"}
        </p>

        {pendingIds.length ? (
          <button
            type="button"
            onClick={() => syncMutation.mutate(pendingIds)}
            disabled={syncMutation.isPending}
            className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-[#e8e3d7] bg-white px-4 text-sm font-extrabold text-[#14201b] transition hover:bg-[#fbfaf6] disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Actualizar pendientes
          </button>
        ) : null}
      </div>

      {data.errorMessage ? (
        <div className="flex items-start gap-3 rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{data.errorMessage}</span>
        </div>
      ) : data.documents.length ? (
        <>
          <div className="hidden overflow-hidden rounded-[20px] border border-[#e8e3d7] bg-white lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e8e3d7] bg-[#f6f3ec] text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
                <tr>
                  <th className="px-4 py-3">Comprobante</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Fecha fiscal</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9df]">
                {data.documents.map((document) => (
                  <DocumentDesktopRow
                    key={document.id}
                    document={document}
                    isOwner={isOwner}
                    retrying={retryMutation.isPending}
                    onRetry={() => retryMutation.mutate(document.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {data.documents.map((document) => (
              <DocumentMobileCard
                key={document.id}
                document={document}
                isOwner={isOwner}
                retrying={retryMutation.isPending}
                onRetry={() => retryMutation.mutate(document.id)}
              />
            ))}
          </div>

          <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-[#7b8680]">
              Página {filters.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              {filters.page > 1 ? (
                <Link
                  href={pageHref(filters.page - 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-[13px] border border-[#e8e3d7] bg-white px-3 font-bold text-[#35423c]"
                >
                  <ChevronLeft className="size-4" />
                  Anterior
                </Link>
              ) : null}
              {filters.page < totalPages ? (
                <Link
                  href={pageHref(filters.page + 1)}
                  className="inline-flex h-10 items-center gap-1 rounded-[13px] border border-[#e8e3d7] bg-white px-3 font-bold text-[#35423c]"
                >
                  Siguiente
                  <ChevronRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      ) : (
        <div className="rounded-[20px] border-2 border-dashed border-[#d8d2c0] bg-white px-5 py-14 text-center">
          <FileCheck2 className="mx-auto size-7 text-[#9b9f99]" />
          <p className="mt-3 text-sm font-extrabold text-[#14201b]">
            No hay comprobantes en este filtro
          </p>
          <p className="mt-1 text-xs text-[#7b8680]">
            Cambia fechas, estado, tipo o búsqueda.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "success" | "info" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "info"
        ? "border-blue-200 bg-blue-50"
        : tone === "danger"
          ? "border-red-200 bg-red-50"
          : "border-[#e8e3d7] bg-white";

  return (
    <article className={`rounded-[18px] border p-3.5 sm:p-4 ${toneClass}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
        {label}
      </p>
      <p className="erp-mono mt-1.5 truncate text-xl font-bold text-[#14201b]">
        {value}
      </p>
      <p className="mt-1 truncate text-[10px] font-semibold text-[#7b8680]">
        {detail}
      </p>
    </article>
  );
}

function StatusBadge({ document }: { document: FiscalDocumentListItem }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] ${documentStatusClass(document.status)}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {DOCUMENT_STATUS_LABELS[document.status]}
    </span>
  );
}

function DocumentDesktopRow({
  document,
  isOwner,
  retrying,
  onRetry,
}: {
  document: FiscalDocumentListItem;
  isOwner: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <tr className="hover:bg-[#fbfaf6]">
      <td className="px-4 py-3.5">
        <Link
          href={`/comprobantes/${document.id}`}
          className="font-extrabold text-[#14201b] hover:text-orange-600"
        >
          {documentNumber(document.series, document.correlative)}
        </Link>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7b8680]">
          {documentTypeLabel(document.document_type)}
        </p>
      </td>
      <td className="max-w-[240px] px-4 py-3.5">
        <p className="truncate font-bold text-[#35423c]">
          {document.customer_name || "Cliente varios"}
        </p>
        <p className="erp-mono mt-0.5 text-[10px] text-[#7b8680]">
          {document.customer_document_number || "Sin documento"}
        </p>
      </td>
      <td className="px-4 py-3.5 text-xs font-semibold text-[#59665f]">
        {formatBusinessDateOnly(document.fiscal_issue_date)}
      </td>
      <td className="px-4 py-3.5 text-xs text-[#59665f]">
        {document.branch_name}
      </td>
      <td className="erp-mono px-4 py-3.5 text-right font-bold text-[#14201b]">
        {formatMoney(document.total_amount)}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge document={document} />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex justify-end gap-2">
          {isOwner && document.status === "queue_failed" ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex h-9 items-center gap-1.5 rounded-[12px] border border-red-200 bg-red-50 px-3 text-xs font-extrabold text-red-700 disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              Retry
            </button>
          ) : null}
          <Link
            href={`/comprobantes/${document.id}`}
            className="inline-flex h-9 items-center rounded-[12px] border border-[#e8e3d7] bg-white px-3 text-xs font-extrabold text-[#14201b]"
          >
            Ver detalle
          </Link>
        </div>
      </td>
    </tr>
  );
}

function DocumentMobileCard({
  document,
  isOwner,
  retrying,
  onRetry,
}: {
  document: FiscalDocumentListItem;
  isOwner: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <article className="rounded-[18px] border border-[#e8e3d7] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/comprobantes/${document.id}`}
            className="erp-mono text-sm font-extrabold text-[#14201b]"
          >
            {documentNumber(document.series, document.correlative)}
          </Link>
          <p className="mt-1 truncate text-xs font-semibold text-[#59665f]">
            {document.customer_name || "Cliente varios"}
          </p>
        </div>
        <StatusBadge document={document} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-[14px] bg-[#f6f3ec] p-3">
        <div>
          <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#9b9f99]">
            Fecha fiscal
          </p>
          <p className="mt-1 text-xs font-bold text-[#14201b]">
            {formatBusinessDateOnly(document.fiscal_issue_date)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#9b9f99]">
            Total
          </p>
          <p className="erp-mono mt-1 text-sm font-bold text-[#14201b]">
            {formatMoney(document.total_amount)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {isOwner && document.status === "queue_failed" ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[13px] border border-red-200 bg-red-50 text-xs font-extrabold text-red-700 disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" />
            Retry
          </button>
        ) : null}
        <Link
          href={`/comprobantes/${document.id}`}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-[13px] bg-[#14201b] text-xs font-extrabold text-white"
        >
          Ver detalle
        </Link>
      </div>
    </article>
  );
}
