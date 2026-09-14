"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
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

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium">
        Correo
        <input
          className="mt-1 h-11 w-full rounded-lg border bg-white px-3 outline-none focus:ring-2 focus:ring-neutral-900/10"
          type="email"
          autoComplete="email"
          required
          disabled={isLoading}
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
          disabled={isLoading}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isLoading}
      >
        {isLoading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogIn className="size-4" aria-hidden="true" />}
        {isLoading ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
