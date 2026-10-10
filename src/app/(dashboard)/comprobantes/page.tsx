import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { DocumentsManager } from "@/features/documents/components/documents-manager";
import { listDocuments } from "@/features/documents/server/documents";
import type {
  DocumentFilters,
  DocumentStatusFilter,
  DocumentTypeFilter,
} from "@/features/documents/types/document";
import {
  getSalesContext,
  listAccessibleBranches,
} from "@/features/sales/server/context";
import { getBusinessDateISO } from "@/lib/date-time";

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const STATUS_OPTIONS: Array<{ value: DocumentStatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "accepted", label: "Aceptados" },
  { value: "pending", label: "En proceso" },
  { value: "rejected", label: "Rechazados" },
  { value: "queue_failed", label: "Cola fallida" },
  { value: "error", label: "Error" },
  { value: "voided", label: "Anulados" },
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");

  const params = await searchParams;
  const today = getBusinessDateISO(new Date(), context.timeZone);
  const monthStart = `${today.slice(0, 8)}01`;

  const rawFrom = first(params.desde);
  const rawTo = first(params.hasta);
  let dateFrom = validDate(rawFrom) ? rawFrom : monthStart;
  let dateTo = validDate(rawTo) ? rawTo : today;

  if (dateFrom > dateTo) {
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  const branches = await listAccessibleBranches(context);
  const requestedBranch = first(params.local);
  const branchId =
    context.role === "cashier" && context.memberBranchId
      ? context.memberBranchId
      : branches.some((branch) => branch.id === requestedBranch)
        ? requestedBranch
        : "";

  const rawType = first(params.tipo);
  const documentType: DocumentTypeFilter =
    rawType === "01" || rawType === "03" ? rawType : "all";

  const rawStatus = first(params.estado);
  const status = STATUS_OPTIONS.some((option) => option.value === rawStatus)
    ? (rawStatus as DocumentStatusFilter)
    : "all";

  const filters: DocumentFilters = {
    q: first(params.q).trim().slice(0, 120),
    dateFrom,
    dateTo,
    branchId,
    documentType,
    status,
    page: Math.max(1, Number.parseInt(first(params.page), 10) || 1),
  };

  const initialData = await listDocuments(context, filters);

  return (
    <section className="space-y-4 sm:space-y-6">
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
          Control fiscal
        </p>
        <h1 className="mt-1 text-[23px] font-extrabold tracking-[-0.02em] text-[#14201b] sm:text-[27px]">
          Comprobantes
        </h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[#7b8680]">
          Consulta boletas y facturas, reconcilia estados con Intifact y descarga los artefactos oficiales emitidos.
        </p>
      </header>

      <form
        method="get"
        className="grid gap-3 rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr_1fr_auto]"
      >
        <label className="sm:col-span-2 xl:col-span-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
            Buscar
          </span>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9f99]" />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Serie, número, cliente o documento"
              className="h-11 w-full rounded-[13px] border border-[#e8e3d7] bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-500"
            />
          </div>
        </label>

        <FilterField label="Desde">
          <input
            type="date"
            name="desde"
            defaultValue={filters.dateFrom}
            className="h-11 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500"
          />
        </FilterField>

        <FilterField label="Hasta">
          <input
            type="date"
            name="hasta"
            defaultValue={filters.dateTo}
            className="h-11 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500"
          />
        </FilterField>

        <FilterField label="Tipo">
          <select
            name="tipo"
            defaultValue={filters.documentType}
            className="h-11 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500"
          >
            <option value="all">Todos</option>
            <option value="03">Boleta</option>
            <option value="01">Factura</option>
          </select>
        </FilterField>

        <FilterField label="Estado">
          <select
            name="estado"
            defaultValue={filters.status}
            className="h-11 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>

        {context.role === "owner" && branches.length > 1 ? (
          <FilterField label="Local">
            <select
              name="local"
              defaultValue={filters.branchId}
              className="h-11 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500"
            >
              <option value="">Todos</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.code} · {branch.name}
                </option>
              ))}
            </select>
          </FilterField>
        ) : filters.branchId ? (
          <input type="hidden" name="local" value={filters.branchId} />
        ) : null}

        <div className="flex items-end sm:col-span-2 xl:col-span-1">
          <button
            type="submit"
            className="h-11 w-full rounded-[13px] bg-[#14201b] px-5 text-sm font-extrabold text-white transition hover:bg-[#1e2d27]"
          >
            Aplicar filtros
          </button>
        </div>
      </form>

      <DocumentsManager
        filters={filters}
        isOwner={context.role === "owner"}
        initialData={initialData}
      />
    </section>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
