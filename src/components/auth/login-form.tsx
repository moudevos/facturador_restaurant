"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LogIn, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const REMEMBER_KEY = "ara-burger:remembered-email";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Credenciales incorrectas o usuario no habilitado.");
      setIsLoading(false);
      return;
    }

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignorar */
    }

    router.replace(nextPath);
    router.refresh();
  }

  const inputClass =
    "block h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-[15px] text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10 disabled:cursor-not-allowed disabled:bg-neutral-50 [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_white_inset]";

  return (
    <div
      className="flex min-h-dvh w-full items-center justify-center px-4 py-10"
      style={{
        backgroundColor: "#0a0a0a",
        backgroundImage:
          "radial-gradient(60% 50% at 50% 0%, rgba(255,255,255,0.10), transparent 70%), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "100% 100%, 48px 48px, 48px 48px",
        backgroundPosition: "center top",
      }}
    >
      <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 shadow-2xl shadow-black/40 ring-1 ring-white/10 sm:px-10">
        {/* Marca */}
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-neutral-900 text-2xl font-bold text-white">
            A
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">Ara Burger</h1>
          <p className="mt-1 text-sm text-neutral-500">Facturador Restaurant</p>
        </div>

        <div className="my-8 h-px w-full bg-neutral-200" />

        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold text-neutral-900">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-neutral-500">Acceso restringido al personal autorizado.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-neutral-800">
              Correo electrónico
            </label>
            <input
              id="email"
              className={inputClass}
              type="email"
              autoComplete="email"
              placeholder="usuario@correo.com"
              required
              disabled={isLoading}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-neutral-800">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                className={`${inputClass} pr-12`}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña"
                required
                disabled={isLoading}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={isLoading}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/30"
              >
                {showPassword ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-3 text-sm text-neutral-600">
            <input
              type="checkbox"
              className="size-4 rounded border-neutral-300 accent-neutral-900"
              checked={remember}
              disabled={isLoading}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Recordar mi correo
          </label>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-[15px] font-medium text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neutral-900/25 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogIn className="size-4" aria-hidden="true" />}
            {isLoading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-neutral-400">
          © {new Date().getFullYear()} Ara Burger. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}