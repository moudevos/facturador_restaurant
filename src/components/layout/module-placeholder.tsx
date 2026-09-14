export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">{description}</p>
      <div className="mt-8 rounded-xl border border-dashed bg-white p-8 text-sm text-neutral-500">
        Módulo preparado para iniciar la implementación funcional.
      </div>
    </section>
  );
}
