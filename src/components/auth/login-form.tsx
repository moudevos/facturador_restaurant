"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, LogIn, TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

const REMEMBER_KEY = "facturador:remembered-email";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(REMEMBER_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(localStorage.getItem(REMEMBER_KEY));
    } catch {
      return false;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      // Storage puede estar deshabilitado.
    }

    router.replace(nextPath);
    router.refresh();
  }

  const inputClass =
    "block h-12 w-full rounded-[14px] border-[1.5px] border-[#e8e3d7] bg-white px-4 text-[15px] text-[#14201b] placeholder:text-[#9b9f99] outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-[#f6f3ec] [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_white_inset]";

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#14201b] px-4 py-8 sm:py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(70% 55% at 50% 0%, rgba(255,122,26,.35), transparent 72%), linear-gradient(to right, rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 44px 44px, 44px 44px",
        }}
      />

      <div className="relative w-full max-w-[410px] rounded-[28px] border border-white/10 bg-[#f6f3ec] px-5 py-7 shadow-2xl shadow-black/30 sm:px-8 sm:py-9">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-[18px] bg-orange-500 text-2xl font-extrabold text-white shadow-[0_12px_30px_-14px_#e86400]">
            A
          </div>
          <h1 className="mt-4 text-[24px] font-extrabold tracking-[-0.03em] text-[#14201b]">
            Ara Burger
          </h1>
          <p className="mt-1 text-xs font-semibold text-[#7b8680]">Facturador Restaurant</p>
        </div>

        <div className="my-6 h-px w-full bg-[#e8e3d7]" />

        <div className="mb-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
            Acceso
          </p>
          <h2 className="mt-1 text-lg font-extrabold text-[#14201b]">Iniciar sesión</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#7b8680]">
            Acceso restringido al personal autorizado.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label htmlFor="email" className="block text-sm font-bold text-[#35423c]">
            Correo electrónico
            <input
              id="email"
              className={`${inputClass} mt-1.5`}
              type="email"
              autoComplete="email"
              placeholder="usuario@correo.com"
              required
              disabled={isLoading}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label htmlFor="password" className="block text-sm font-bold text-[#35423c]">
            Contraseña
            <div className="relative mt-1.5">
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
                className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[11px] text-[#7b8680] transition hover:bg-[#f6f3ec] hover:text-[#14201b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                {showPassword ? (
                  <EyeOff className="size-[18px]" aria-hidden="true" />
                ) : (
                  <Eye className="size-[18px]" aria-hidden="true" />
                )}
              </button>
            </div>
          </label>

          <label className="flex cursor-pointer select-none items-center gap-3 py-1 text-sm font-semibold text-[#59665f]">
            <input
              type="checkbox"
              className="size-4 rounded border-[#d8d2c0] accent-orange-500"
              checked={remember}
              disabled={isLoading}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Recordar mi correo
          </label>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[15px] border border-red-200 bg-[#fde8e8] px-4 py-3 text-sm font-semibold text-[#b83232]"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-orange-500 px-4 text-[15px] font-extrabold text-white shadow-[0_8px_20px_-8px_#e86400] transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300/60 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            )}
            {isLoading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-7 text-center text-[10px] font-semibold text-[#9b9f99]">
          © {new Date().getFullYear()} Ara Burger · Facturador Restaurant
        </p>
      </div>
    </div>
  );
}
