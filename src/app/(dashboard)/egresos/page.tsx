import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { ExpensesManager } from "@/features/expenses/components/expenses-manager";
import {
  getExpenseContext,
  listExpenseBranches,
  listExpenses,
} from "@/features/expenses/server/expenses";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseFilters,
  type ExpenseStatusFilter,
} from "@/features/expenses/types/expense";
import { getBusinessDateISO } from "@/lib/date-time";

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getExpenseContext();
  if (!context) redirect("/configuracion");

  const params = await searchParams;
  const branches = await listExpenseBranches(context);
  const today = getBusinessDateISO(new Date(), context.timeZone);
  const monthStart = `${today.slice(0, 8)}01`;

  const rawStatus = first(params.estado);
  const status: ExpenseStatusFilter =
    rawStatus === "anulados" || rawStatus === "todos" ? rawStatus : "activos";

  const rawCategory = first(params.categoria);
  const category = EXPENSE_CATEGORIES.some((item) => item.value === rawCategory)
    ? (rawCategory as ExpenseCategory)
    : "";

  let branchId = first(params.local);
  if (context.role === "cashier" && context.branchId) branchId = context.branchId;
  if (branchId && !branches.some((branch) => branch.id === branchId)) branchId = "";

  const filters: ExpenseFilters = {
    query: first(params.q).trim().slice(0, 120),
    branchId,
    category,
    status,
    dateFrom: validDate(first(params.desde)) ? first(params.desde) : monthStart,
    dateTo: validDate(first(params.hasta)) ? first(params.hasta) : today,
    page: Math.max(1, Number.parseInt(first(params.page), 10) || 1),
  };

  const result = await listExpenses({ context, filters });
  const isOwner = context.role === "owner";

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#14201b]">Egresos</h1>
        <p className="mt-1 text-sm text-[#7b8680]">
          Registro de compras y salidas de dinero. Los egresos financieros se anulan; no se editan ni eliminan.
        </p>
      </header>

      {!isOwner ? (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Tu rol es cajero. Puedes consultar los egresos permitidos por tu local, pero solo un propietario puede registrarlos o anularlos.
        </div>
      ) : null}

      <form className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 shadow-sm" role="search">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs font-medium text-[#59665f] xl:col-span-2">
            Buscar
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9f99]" aria-hidden="true" />
              <input
                name="q"
                defaultValue={filters.query}
                placeholder="Descripción o notas"
                className="h-10 w-full rounded-[13px] border border-[#e8e3d7] bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-neutral-900/5"
              />
            </div>
          </label>

          <label className="text-xs font-medium text-[#59665f]">
            Desde
            <input name="desde" type="date" defaultValue={filters.dateFrom} className="mt-1.5 h-10 w-full rounded-[13px] border border-[#e8e3d7] px-3 text-sm outline-none focus:border-orange-500" />
          </label>

          <label className="text-xs font-medium text-[#59665f]">
            Hasta
            <input name="hasta" type="date" defaultValue={filters.dateTo} className="mt-1.5 h-10 w-full rounded-[13px] border border-[#e8e3d7] px-3 text-sm outline-none focus:border-orange-500" />
          </label>

          <label className="text-xs font-medium text-[#59665f]">
            Local
            <select
              name="local"
              defaultValue={filters.branchId}
              disabled={context.role === "cashier" && Boolean(context.branchId)}
              className="mt-1.5 h-10 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500 disabled:bg-[#f6f3ec]"
            >
              <option value="">Todos</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>
              ))}
            </select>
            {context.role === "cashier" && context.branchId ? <input type="hidden" name="local" value={context.branchId} /> : null}
          </label>

          <label className="text-xs font-medium text-[#59665f]">
            Categoría
            <select name="categoria" defaultValue={filters.category} className="mt-1.5 h-10 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500">
              <option value="">Todas</option>
              {EXPENSE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[#eee9df] pt-3">
          <label className="text-xs font-medium text-[#59665f]">
            Estado
            <select name="estado" defaultValue={filters.status} className="mt-1.5 h-10 rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm outline-none focus:border-orange-500">
              <option value="activos">Activos</option>
              <option value="anulados">Anulados</option>
              <option value="todos">Todos</option>
            </select>
          </label>

          <div className="flex gap-2">
            <Link href="/egresos" className="inline-flex h-10 items-center justify-center rounded-[13px] border border-[#e8e3d7] bg-white px-4 text-sm font-medium text-[#35423c] hover:bg-[#f6f3ec]">
              Restablecer
            </Link>
            <button type="submit" className="h-10 rounded-[13px] bg-[#14201b] px-4 text-sm font-medium text-white hover:bg-[#1e2d27]">
              Aplicar filtros
            </button>
          </div>
        </div>
      </form>

      <ExpensesManager
        organizationId={context.organizationId}
        filters={filters}
        isOwner={isOwner}
        branches={branches}
        timeZone={context.timeZone}
        initialData={{
          expenses: result.expenses,
          count: result.count,
          totalAmount: result.totalAmount,
          errorMessage: result.error
            ? "No pudimos cargar los egresos. Verifica que el SQL 009 esté aplicado."
            : null,
        }}
      />
    </section>
  );
}
