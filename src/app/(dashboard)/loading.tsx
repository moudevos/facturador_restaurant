export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Cargando contenido">
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-neutral-200" />
        <div className="h-8 w-56 rounded bg-neutral-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-xl border bg-white p-5">
            <div className="h-4 w-28 rounded bg-neutral-200" />
            <div className="mt-4 h-7 w-20 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
