export default function DashboardRouteLoading() {
  return (
    <section className="space-y-4 sm:space-y-6" aria-label="Cargando Dashboard">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-[10px] bg-[#e8e3d7]" />
        <div className="h-4 w-56 animate-pulse rounded-[8px] bg-[#eee9df]" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-[18px] border border-[#e8e3d7] bg-white"
          />
        ))}
      </div>
    </section>
  );
}
