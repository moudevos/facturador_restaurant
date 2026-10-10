"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  ReceiptText,
} from "lucide-react";

import { useFeedback } from "@/components/feedback";
import type { Branch } from "@/features/settings/types";
import { createExpenseAction, voidExpenseAction } from "../server/actions";
import { listExpensesAction } from "../server/list-action";
import {
  EXPENSES_PER_PAGE,
  type Expense,
  type ExpenseFilters,
  type ExpenseListData,
} from "../types/expense";
import { formatExpenseAmount } from "../utils/expense-format";
import { ExpenseCreateModal } from "./expense-create-modal";
import { ExpensesTable } from "./expenses-table";

export function ExpensesManager({
  organizationId,
  filters,
  isOwner,
  branches,
  timeZone,
  initialData,
}: {
  organizationId: string;
  filters: ExpenseFilters;
  isOwner: boolean;
  branches: Branch[];
  timeZone: string;
  initialData: ExpenseListData;
}) {
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const [createOpen, setCreateOpen] = useState(false);

  const expensesQuery = useQuery({
    queryKey: ["expenses", organizationId, filters],
    queryFn: () => listExpensesAction(filters),
    initialData,
  });

  const createMutation = useMutation({ mutationFn: createExpenseAction });
  const voidMutation = useMutation({ mutationFn: voidExpenseAction });

  const data = expensesQuery.data;
  const totalPages = Math.max(1, Math.ceil(data.count / EXPENSES_PER_PAGE));
  const from = data.expenses.length ? (filters.page - 1) * EXPENSES_PER_PAGE + 1 : 0;
  const to = from + data.expenses.length - 1;
  const activeBranches = branches.filter((branch) => branch.active);

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.branchId) params.set("local", filters.branchId);
    if (filters.category) params.set("categoria", filters.category);
    if (filters.status !== "activos") params.set("estado", filters.status);
    if (filters.dateFrom) params.set("desde", filters.dateFrom);
    if (filters.dateTo) params.set("hasta", filters.dateTo);
    if (page > 1) params.set("page", String(page));
    return `/egresos?${params.toString()}`;
  }

  async function createExpense(formData: FormData) {
    const result = await createMutation.mutateAsync(formData);
    if (!result.success) return result;

    await queryClient.invalidateQueries({ queryKey: ["expenses", organizationId] });
    setCreateOpen(false);
    toast.success(result.message);
    return result;
  }

  async function voidExpense(expense: Expense) {
    const accepted = await confirm({
      title: "Anular egreso",
      description:
        "El egreso quedará anulado de forma irreversible. No se eliminará del historial ni podrá reactivarse.",
      tone: "danger",
      confirmText: "Anular egreso",
      cancelText: "Cancelar",
    });
    if (!accepted) return;

    const result = await voidMutation.mutateAsync(expense.id);
    if (!result.success) {
      toast.error(result.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["expenses", organizationId] });
    toast.success(result.message);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-stretch">
        <div className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Monto del filtro</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
              {formatExpenseAmount(data.totalAmount)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {data.count} {data.count === 1 ? "registro" : "registros"}
            </p>
          </div>
          {expensesQuery.isFetching ? (
            <LoaderCircle className="size-5 animate-spin text-neutral-300" aria-label="Actualizando egresos" />
          ) : (
            <ReceiptText className="size-6 text-neutral-300" aria-hidden="true" />
          )}
        </div>

        {isOwner ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={activeBranches.length === 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-44"
          >
            <Plus className="size-4" aria-hidden="true" />
            Registrar egreso
          </button>
        ) : null}
      </div>

      {data.errorMessage ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium text-red-900">No se pudieron cargar los egresos</p>
            <p className="mt-0.5">{data.errorMessage}</p>
          </div>
        </div>
      ) : data.expenses.length ? (
        <>
          <div aria-busy={expensesQuery.isFetching}>
            <ExpensesTable
              expenses={data.expenses}
              branches={branches}
              isOwner={isOwner}
              onVoid={(expense) => void voidExpense(expense)}
              isVoiding={voidMutation.isPending}
            />
          </div>

          <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-neutral-500">
              Mostrando <span className="font-medium text-neutral-900">{from}–{to}</span> de{" "}
              <span className="font-medium text-neutral-900">{data.count}</span>
            </p>
            <div className="flex gap-2">
              {filters.page > 1 ? (
                <Link href={pageHref(filters.page - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Anterior
                </Link>
              ) : null}
              {filters.page < totalPages ? (
                <Link href={pageHref(filters.page + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50">
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <ReceiptText className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-4 font-medium text-neutral-900">No hay egresos con estos filtros</p>
          <p className="mt-1 text-sm text-neutral-500">
            Ajusta el período o registra una nueva salida de dinero.
          </p>
        </div>
      )}

      <ExpenseCreateModal
        open={createOpen}
        isSaving={createMutation.isPending}
        branches={activeBranches}
        timeZone={timeZone}
        onClose={() => setCreateOpen(false)}
        onCreate={createExpense}
        onCreated={() => undefined}
      />
    </div>
  );
}
