import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedPath = typeof params.next === "string" ? params.next : null;
  const nextPath = requestedPath?.startsWith("/") ? requestedPath : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-500">Facturador Restaurant</p>
          <h1 className="mt-1 text-2xl font-semibold">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-neutral-500">Acceso restringido al personal autorizado.</p>
        </div>
        <LoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
