import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-medium text-neutral-500">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Página no encontrada</h1>
        <p className="mt-2 text-sm text-neutral-500">La dirección solicitada no existe o dejó de estar disponible.</p>
        <Link className="mt-6 inline-flex h-10 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white" href="/dashboard">
          Volver al dashboard
        </Link>
      </section>
    </main>
  );
}
