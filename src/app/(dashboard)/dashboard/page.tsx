const CARDS = [
  { label: "Facturado hoy", value: "S/ 0.00" },
  { label: "Egresos hoy", value: "S/ 0.00" },
  { label: "Resultado simple", value: "S/ 0.00" },
  { label: "Boletas emitidas", value: "0" },
] as const;

export default function DashboardPage() {
  return (
    <section>
      <div>
        <p className="text-sm font-medium text-neutral-500">Resumen</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Los valores son placeholders hasta conectar consultas reales de Supabase.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <article key={card.label} className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-neutral-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 rounded-xl border bg-white p-5">
        <p className="text-sm font-medium">Definición financiera del MVP</p>
        <p className="mt-2 text-sm text-neutral-500">
          Resultado simple = montos facturados − egresos registrados. No representa utilidad ni margen real.
        </p>
      </div>
    </section>
  );
}
