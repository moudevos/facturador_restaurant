"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-xl border bg-white p-6">
      <AlertTriangle className="size-6" aria-hidden="true" />
      <h1 className="mt-4 text-lg font-semibold">No pudimos cargar esta sección</h1>
      <p className="mt-2 text-sm text-neutral-500">
        La operación no se completó. Puedes volver a intentarlo sin recargar toda la aplicación.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-neutral-400">Referencia: {error.digest}</p>
      ) : null}
      <button
        className="mt-5 flex h-10 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white"
        type="button"
        onClick={reset}
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        Reintentar
      </button>
    </section>
  );
}
