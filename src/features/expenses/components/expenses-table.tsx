"use client";

import { Ban } from "lucide-react";

import type { Branch } from "@/features/settings/types";
import { formatBusinessDateOnly } from "@/lib/date-time";
import {
  expenseCategoryLabel,
  type Expense,
} from "../types/expense";
import { formatExpenseAmount } from "../utils/expense-format";

function StatusBadge({ voided }: { voided: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        voided ? "bg-[#e9e4d6] text-[#59665f]" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      <span className={`size-1.5 rounded-full ${voided ? "bg-neutral-400" : "bg-emerald-500"}`} />
      {voided ? "Anulado" : "Activo"}
    </span>
  );
}

export function ExpensesTable({
  expenses,
  branches,
  isOwner,
  onVoid,
  isVoiding,
}: {
  expenses: Expense[];
  branches: Branch[];
  isOwner: boolean;
  onVoid: (expense: Expense) => void;
  isVoiding: boolean;
}) {
  const branchName = (id: string) => {
    const branch = branches.find((item) => item.id === id);
    return branch ? `${branch.code} · ${branch.name}` : "Local no disponible";
  };

  return (
    <>
      <div className="hidden overflow-hidden rounded-[18px] border border-[#e8e3d7] bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#e8e3d7] bg-[#f6f3ec]/70 text-xs uppercase tracking-wide text-[#7b8680]">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Local</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {expenses.map((expense) => (
              <tr key={expense.id} className={expense.is_voided ? "bg-[#f6f3ec]/60 text-[#7b8680]" : ""}>
                <td className="whitespace-nowrap px-4 py-3.5">
                  {formatBusinessDateOnly(expense.expense_date)}
                </td>
                <td className="max-w-xs px-4 py-3.5">
                  <p className="font-medium text-[#14201b]">{expense.description}</p>
                  {expense.notes ? <p className="mt-0.5 truncate text-xs text-[#7b8680]">{expense.notes}</p> : null}
                </td>
                <td className="px-4 py-3.5">{expenseCategoryLabel(expense.category)}</td>
                <td className="px-4 py-3.5">{branchName(expense.branch_id)}</td>
                <td className="px-4 py-3.5 text-right font-bold tabular-nums text-[#14201b]">
                  {formatExpenseAmount(expense.amount)}
                </td>
                <td className="px-4 py-3.5"><StatusBadge voided={expense.is_voided} /></td>
                <td className="px-4 py-3.5 text-right">
                  {isOwner && !expense.is_voided ? (
                    <button
                      type="button"
                      onClick={() => onVoid(expense)}
                      disabled={isVoiding}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[13px] px-3 text-sm font-medium text-[#59665f] transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <Ban className="size-3.5" aria-hidden="true" />
                      Anular
                    </button>
                  ) : (
                    <span className="text-[#c6c0b3]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {expenses.map((expense) => (
          <article key={expense.id} className="rounded-[18px] border border-[#e8e3d7] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-[#14201b]">{expense.description}</p>
                <p className="mt-1 text-xs text-[#7b8680]">
                  {formatBusinessDateOnly(expense.expense_date)} · {expenseCategoryLabel(expense.category)}
                </p>
              </div>
              <StatusBadge voided={expense.is_voided} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-[#9b9f99]">{branchName(expense.branch_id)}</p>
                {expense.notes ? <p className="mt-1 text-xs text-[#7b8680]">{expense.notes}</p> : null}
              </div>
              <p className="text-base font-bold tabular-nums text-[#14201b]">
                {formatExpenseAmount(expense.amount)}
              </p>
            </div>
            {isOwner && !expense.is_voided ? (
              <button
                type="button"
                onClick={() => onVoid(expense)}
                disabled={isVoiding}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[13px] border border-[#e8e3d7] text-sm font-medium text-[#35423c] hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                <Ban className="size-4" aria-hidden="true" />
                Anular egreso
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
