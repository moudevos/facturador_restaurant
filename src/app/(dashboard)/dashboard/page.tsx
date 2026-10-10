// Dashboard principal consolidado; no mezclar con implementaciones legacy.
import {
  Banknote,
  CircleDollarSign,
  ReceiptText,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getDashboardData } from "@/features/dashboard/server/dashboard";
import { getSalesContext } from "@/features/sales/server/context";
import {
  formatMoney,
  PAYMENT_LABELS,
  sessionCode,
} from "@/features/sales/utils/format";
import { formatBusinessDateOnly } from "@/lib/date-time";

function dayLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
}

export default async function DashboardPage() {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");

  const data = await getDashboardData(context);
  const max = Math.max(1, ...data.last7Days.map((day) => day.amount));
  const currentSession = data.openSessions[0];

  const cards = [
    {
      label: "Ventas de hoy",
      value: formatMoney(data.todayCollected),
      detail: `Facturado aceptado: ${formatMoney(data.todayInvoiced)}`,
      highlighted: true,
      icon: CircleDollarSign,
    },
    {
      label: "Ventas del mes",
      value: formatMoney(data.monthCollected),
      detail: "Cobrado en el POS",
      icon: ShoppingBag,
    },
    {
      label: "Egresos del mes",
      value: formatMoney(data.monthExpenses),
      detail: "Egresos no anulados",
      icon: Banknote,
    },
    {
      label: "Resultado simple",
      value: formatMoney(data.monthSimpleResult),
      detail: "Facturado aceptado − egresos",
      icon: ReceiptText,
    },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-orange-600">Resumen operativo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Fecha de negocio: {formatBusinessDateOnly(data.businessDate)}
          </p>
        </div>
        <div className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 shadow-sm">
          {data.todayDocuments} comprobantes aceptados hoy
        </div>
      </header>

      {data.errorMessage ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {data.errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className={`rounded-2xl border p-5 shadow-sm ${
                card.highlighted
                  ? "border-[#14201b] bg-[#14201b] text-white"
                  : "border-neutral-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${card.highlighted ? "text-white/50" : "text-neutral-400"}`}>
                    {card.label}
                  </p>
                  <p className={`mt-2 text-2xl font-semibold tabular-nums ${card.highlighted ? "text-orange-400" : "text-neutral-900"}`}>
                    {card.value}
                  </p>
                  <p className={`mt-1 text-xs ${card.highlighted ? "text-white/50" : "text-neutral-500"}`}>
                    {card.detail}
                  </p>
                </div>
                <Icon className={`size-5 ${card.highlighted ? "text-orange-400" : "text-neutral-300"}`} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="font-semibold text-neutral-900">Ventas · últimos 7 días</h2>
              <p className="mt-1 text-xs text-neutral-500">Cobros registrados en el POS</p>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatMoney(data.last7Days.reduce((sum, day) => sum + day.amount, 0))}
            </p>
          </div>

          <div className="mt-6 flex h-44 items-end gap-2">
            {data.last7Days.map((day) => {
              const height = day.amount ? Math.max(8, (day.amount / max) * 100) : 4;
              const current = day.date === data.businessDate;
              return (
                <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-semibold tabular-nums text-neutral-500">
                    {day.amount ? `${Math.round(day.amount / 100) / 10}k` : "0"}
                  </span>
                  <div className="flex h-[112px] w-full items-end justify-center">
                    <div
                      className={`w-full max-w-11 rounded-t-lg ${
                        current ? "bg-orange-500" : "bg-orange-200"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold ${current ? "text-neutral-900" : "text-neutral-400"}`}>
                    {current ? "hoy" : dayLabel(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-neutral-900">Sesión de caja</h2>
              <p className="mt-1 text-xs text-neutral-500">Estado operativo actual</p>
            </div>
            <WalletCards className="size-5 text-neutral-300" />
          </div>

          {currentSession ? (
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{sessionCode(currentSession.session_id)}</p>
                  <p className="mt-1 text-xs text-neutral-500">{currentSession.sales_count} ventas</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Abierta
                </span>
              </div>

              <div className="mt-5 rounded-xl bg-neutral-950 p-4 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Efectivo esperado</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-orange-400">
                  {formatMoney(currentSession.current_expected_cash)}
                </p>
              </div>

              <a
                href="/ventas"
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Ver área de venta
              </a>
            </div>
          ) : (
            <div className="mt-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-neutral-100">
                <WalletCards className="size-5 text-neutral-400" />
              </div>
              <p className="mt-3 text-sm font-semibold">Sin sesión abierta</p>
              <p className="mt-1 text-xs text-neutral-500">Abre una sesión para habilitar el POS.</p>
              <a href="/ventas" className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white">
                Área de venta
              </a>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Últimas ventas</h2>
            <span className="text-xs text-neutral-400">Actividad reciente</span>
          </div>
          {data.recentSales.length ? (
            <div className="divide-y divide-neutral-100">
              {data.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 py-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50">
                    <ReceiptText className="size-4 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {sale.customer_name || "Cliente varios"}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {sale.series}-{String(sale.correlative).padStart(8, "0")}
                      {sale.payment_method ? ` · ${PAYMENT_LABELS[sale.payment_method]}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(sale.total_amount)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-neutral-500">Aún no hay ventas registradas.</p>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Egresos recientes</h2>
            <a href="/egresos" className="text-xs font-semibold text-orange-600">Ver egresos</a>
          </div>
          {data.recentExpenses.length ? (
            <div className="divide-y divide-neutral-100">
              {data.recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-3 py-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-red-50">
                    <Banknote className="size-4 text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{expense.description}</p>
                    <p className="mt-0.5 text-xs capitalize text-neutral-500">
                      {expense.category} · {formatBusinessDateOnly(expense.expense_date)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-red-600">
                    −{formatMoney(expense.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-neutral-500">No hay egresos recientes.</p>
          )}
        </section>
      </div>
    </section>
  );
}
