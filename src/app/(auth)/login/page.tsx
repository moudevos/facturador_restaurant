"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Credenciales incorrectas o usuario no habilitado.");
      setIsLoading(false);
      return;
    }

    const next = searchParams.get("next");
    router.replace(next?.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-neutral-500">Facturador Restaurant</p>
          <h1 className="mt-1 text-2xl font-semibold">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-neutral-500">Acceso restringido al personal autorizado.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            Correo
            <input
              className="mt-1 h-11 w-full rounded-lg border bg-white px-3 outline-none focus:ring-2 focus:ring-neutral-900/10"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block text-sm font-medium">
            Contraseña
            <input
              className="mt-1 h-11 w-full rounded-lg border bg-white px-3 outline-none focus:ring-2 focus:ring-neutral-900/10"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button
            className="h-11 w-full rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
