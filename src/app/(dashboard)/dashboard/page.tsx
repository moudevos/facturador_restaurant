import Link from "next/link";
import {
  Banknote,
  CircleDollarSign,
  ReceiptText,
  ShoppingBag,
  Store,
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
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");
}

function shortAmount(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
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
    <section className="space-y-4 sm:space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[23px] font-extrabold tracking-[-0.02em] text-[#14201b] sm:text-[27px]">
            Dashboard
          </h1>
          <p className="mt-1 text-[13px] text-[#7b8680]">
            Resumen operativo · {formatBusinessDateOnly(data.businessDate)}
          </p>
        </div>
        <span className="hidden rounded-full border border-[#e8e3d7] bg-white px-3 py-1.5 text-xs font-bold text-[#7b8680] sm:inline-flex">
          {data.todayDocuments} comprobantes aceptados hoy
        </span>
      </header>

      {data.errorMessage ? (
        <div role="alert" className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {data.errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4 xl:gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className={`min-w-0 rounded-[18px] border p-3.5 sm:p-4 ${
                card.highlighted
                  ? "border-[#14201b] bg-[#14201b] text-white"
                  : "border-[#e8e3d7] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`truncate text-[10px] font-bold uppercase tracking-[0.08em] ${
                      card.highlighted ? "text-[#9fb0a8]" : "text-[#7b8680]"
                    }`}
                  >
                    {card.label}
                  </p>
                  <p
                    className={`erp-mono mt-1.5 truncate text-[18px] font-bold tracking-[-0.03em] sm:text-[22px] ${
                      card.highlighted ? "text-orange-400" : "text-[#14201b]"
                    }`}
                  >
                    {card.value}
                  </p>
                  <p
                    className={`mt-1 truncate text-[10px] font-semibold sm:text-[11px] ${
                      card.highlighted ? "text-[#9fb0a8]" : "text-[#7b8680]"
                    }`}
                  >
                    {card.detail}
                  </p>
                </div>
                <Icon
                  className={`size-4 shrink-0 sm:size-5 ${
                    card.highlighted ? "text-orange-400" : "text-[#c6c0b3]"
                  }`}
                />
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-extrabold text-[#14201b]">Ventas · últimos 7 días</h2>
              <p className="mt-1 text-xs text-[#7b8680]">Cobros registrados en el POS</p>
            </div>
            <p className="erp-mono text-xs font-bold text-[#14201b] sm:text-sm">
              {formatMoney(data.last7Days.reduce((sum, day) => sum + day.amount, 0))}
            </p>
          </div>

          <div className="mt-5 flex h-40 items-end gap-1.5 sm:gap-2">
            {data.last7Days.map((day) => {
              const height = day.amount ? Math.max(8, (day.amount / max) * 100) : 4;
              const current = day.date === data.businessDate;
              return (
                <div
                  key={day.date}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="erp-mono text-[9px] font-bold text-[#7b8680] sm:text-[10px]">
                    {shortAmount(day.amount)}
                  </span>
                  <div className="flex h-[108px] w-full items-end justify-center">
                    <div
                      className={`w-full max-w-11 rounded-t-[9px] transition-all ${
                        current ? "bg-orange-500" : "bg-[#ffd2ab]"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-bold capitalize ${
                      current ? "text-[#14201b]" : "text-[#9b9f99]"
                    }`}
                  >
                    {current ? "hoy" : dayLabel(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-[#e8e3d7] bg-white">
          <div className="flex items-center justify-between px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
            <div>
              <h2 className="text-[15px] font-extrabold text-[#14201b]">Sesión de caja</h2>
              <p className="mt-1 text-xs text-[#7b8680]">Estado operativo actual</p>
            </div>
            <WalletCards className="size-5 text-[#c6c0b3]" />
          </div>

          {currentSession ? (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold text-[#14201b]">{sessionCode(currentSession.session_id)}</p>
                  <p className="mt-1 text-xs text-[#7b8680]">{currentSession.sales_count} ventas</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dff5e9] px-2.5 py-1 text-[11px] font-extrabold text-[#1f7f52]">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  ABIERTA
                </span>
              </div>

              <div className="mt-4 rounded-[17px] bg-[#14201b] p-4 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9fb0a8]">
                  Efectivo esperado
                </p>
                <p className="erp-mono mt-1 text-2xl font-bold tracking-[-0.03em] text-orange-400">
                  {formatMoney(currentSession.current_expected_cash)}
                </p>
              </div>

              <Link
                href="/ventas"
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-orange-500 text-sm font-bold text-white shadow-[0_8px_20px_-10px_#e86400]"
              >
                <Store className="size-4" />
                Ver área de venta
              </Link>
            </div>
          ) : (
            <div className="px-4 pb-5 text-center sm:px-5">
              <div className="mx-auto mt-3 flex size-12 items-center justify-center rounded-full bg-[#fff0e2]">
                <WalletCards className="size-5 text-orange-500" />
              </div>
              <p className="mt-3 text-sm font-extrabold text-[#14201b]">Sin sesión abierta</p>
              <p className="mt-1 text-xs text-[#7b8680]">Abre una sesión para habilitar el POS.</p>
              <Link
                href="/ventas"
                className="mt-4 inline-flex h-11 items-center justify-center rounded-[14px] bg-orange-500 px-5 text-sm font-bold text-white"
              >
                Abrir área de venta
              </Link>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold text-[#14201b]">Últimas ventas</h2>
            <span className="text-[11px] font-bold text-[#9b9f99]">Actividad reciente</span>
          </div>
          {data.recentSales.length ? (
            <div className="divide-y divide-[#eee9df]">
              {data.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 py-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[#fff0e2]">
                    <ReceiptText className="size-4 text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[#14201b]">
                      {sale.customer_name || "Cliente varios"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#7b8680]">
                      {sale.series}-{String(sale.correlative).padStart(8, "0")}
                      {sale.payment_method ? ` · ${PAYMENT_LABELS[sale.payment_method]}` : ""}
                    </p>
                  </div>
                  <p className="erp-mono text-xs font-bold text-[#14201b] sm:text-sm">
                    {formatMoney(sale.total_amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#7b8680]">Aún no hay ventas registradas.</p>
          )}
        </section>

        <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold text-[#14201b]">Egresos recientes</h2>
            <Link href="/egresos" className="text-[11px] font-extrabold text-orange-600">
              Ver egresos
            </Link>
          </div>
          {data.recentExpenses.length ? (
            <div className="divide-y divide-[#eee9df]">
              {data.recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-3 py-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-red-50">
                    <Banknote className="size-4 text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-[#14201b]">{expense.description}</p>
                    <p className="mt-0.5 truncate text-[11px] capitalize text-[#7b8680]">
                      {expense.category} · {formatBusinessDateOnly(expense.expense_date)}
                    </p>
                  </div>
                  <p className="erp-mono text-xs font-bold text-red-600 sm:text-sm">
                    −{formatMoney(expense.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-[#7b8680]">No hay egresos recientes.</p>
          )}
        </section>
      </div>
    </section>
  );
}
