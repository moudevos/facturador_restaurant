import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, Wallet } from "lucide-react";

import { getSalesContext } from "@/features/sales/server/context";
import { formatMoney } from "@/features/sales/utils/format";
import { getBusinessDateISO } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/server";

type Params = { desde?: string | string[]; hasta?: string | string[] };
type DailyRow = {
  business_date: string;
  income_amount: number | string;
  expense_amount: number | string;
  result_amount: number | string;
};

const isoDate = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value))
    ? value
    : null;

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
}

export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");

  const params = await searchParams;
  const today = getBusinessDateISO(new Date(), context.timeZone);
  const firstOfMonth = today.slice(0, 8) + "01";
  const from = isoDate(params.desde) ?? firstOfMonth;
  const to = isoDate(params.hasta) ?? today;
  const validRange = from <= to;

  const supabase = await createClient();
  const { data, error } = validRange
    ? await supabase
        .from("v_restaurant_daily_result")
        .select("business_date,income_amount,expense_amount,result_amount")
        .eq("organization_id", context.organizationId)
        .gte("business_date", from)
        .lte("business_date", to)
        .order("business_date", { ascending: false })
        .limit(1000)
    : { data: [], error: null };

  // La vista devuelve una fila por local y día; el resumen muestra un único
  // día consolidado para todos los locales autorizados.
  const daily = new Map<string, { business_date:string; income_amount:number; expense_amount:number; result_amount:number }>();
  for (const row of ((data ?? []) as DailyRow[])) {
    const previous = daily.get(row.business_date) ?? {
      business_date:row.business_date, income_amount:0, expense_amount:0, result_amount:0,
    };
    previous.income_amount += Number(row.income_amount);
    previous.expense_amount += Number(row.expense_amount);
    previous.result_amount += Number(row.result_amount);
    daily.set(row.business_date, previous);
  }
  const rows = [...daily.values()].sort((a,b) => b.business_date.localeCompare(a.business_date));
  const income = rows.reduce((sum, row) => sum + row.income_amount, 0);
  const expenses = rows.reduce((sum, row) => sum + row.expense_amount, 0);
  const net = income - expenses;

  const stats = [
    { label: "Ingresos", value: income, icon: ArrowDownRight, accent: "text-emerald-700" },
    { label: "Egresos", value: expenses, icon: ArrowUpRight, accent: "text-rose-700" },
    { label: "Resultado simple", value: net, icon: Wallet, accent: net < 0 ? "text-rose-700" : "text-emerald-700" },
  ];

  return (
    <section className="space-y-5 sm:space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Finanzas</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#14201b] sm:text-3xl">
            Resultado del restaurante
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#63746a]">
            Ingresos menos egresos por fecha de negocio. Las compras a crédito
            cuentan como egreso una sola vez, aunque se paguen después.
          </p>
        </div>
        <ChartNoAxesCombined aria-hidden="true" className="size-7 text-orange-600" />
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e8e3d7] bg-white p-4" aria-label="Filtrar resultados por fechas">
        <label className="grid gap-1.5 text-xs font-semibold text-[#35423c]">
          Desde
          <input name="desde" type="date" required defaultValue={from}
            className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-[#35423c]">
          Hasta
          <input name="hasta" type="date" required defaultValue={to}
            className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-[#14201b] px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
          Ver resultado
        </button>
        <Link href="/resultado" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-[#53645a] underline underline-offset-4">
          Mes actual
        </Link>
      </form>

      {!validRange ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          La fecha inicial no puede ser posterior a la fecha final.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No se pudo cargar el reporte. Comprueba que SQL 017 esté aplicado en Supabase.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="rounded-2xl border border-[#e8e3d7] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#63746a]">{stat.label}</p>
                <Icon aria-hidden="true" className={"size-5 " + stat.accent} />
              </div>
              <p className={"erp-mono mt-3 text-2xl font-extrabold tracking-tight " + stat.accent}>
                {formatMoney(stat.value)}
              </p>
            </article>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#e8e3d7] bg-white shadow-sm">
        <div className="border-b border-[#eee9df] px-5 py-4">
          <h2 className="text-base font-extrabold text-[#14201b]">Detalle diario</h2>
          <p className="mt-1 text-xs text-[#63746a]">Importes operativos; las anulaciones se reflejan como ajustes.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead className="bg-[#f8f6f1] text-xs font-bold uppercase tracking-wide text-[#63746a]">
              <tr>
                <th scope="col" className="px-5 py-3">Fecha</th>
                <th scope="col" className="px-5 py-3 text-right">Ingresos</th>
                <th scope="col" className="px-5 py-3 text-right">Egresos</th>
                <th scope="col" className="px-5 py-3 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee9df]">
              {rows.map((row) => (
                <tr key={row.business_date}>
                  <th scope="row" className="whitespace-nowrap px-5 py-3 font-semibold text-[#14201b]">{fmtDate(row.business_date)}</th>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMoney(Number(row.income_amount))}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatMoney(Number(row.expense_amount))}</td>
                  <td className={"px-5 py-3 text-right font-bold tabular-nums " + (Number(row.result_amount) < 0 ? "text-rose-700" : "text-emerald-700")}>
                    {formatMoney(Number(row.result_amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error && validRange ? (
            <p className="p-6 text-center text-sm text-[#63746a]">Sin movimientos en estas fechas.</p>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-[#63746a]">
        Resultado simple, no utilidad neta tributaria. No incluye inventario,
        depreciación ni ajustes contables; los egresos se reconocen al registrarse,
        independientemente de cuándo se paguen. El arqueo de caja es independiente.
      </p>
    </section>
  );
}
