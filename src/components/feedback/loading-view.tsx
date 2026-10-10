"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clock } from "lucide-react";

export type SlowMessage = { /** Segundos transcurridos */ after: number; text: string };

export type LoadingOptions = {
  /** "spinner" (defecto) o "progress" (barra). */
  variant?: "spinner" | "progress";
  title?: string;
  subtitle?: string;
  /** Mensaje variable (ej. "Importando producto 3 de 10"). */
  message?: string;
  /** 0–100. En "progress", si no se define la barra es indeterminada. */
  progress?: number;
  /** Avisos que aparecen si la carga tarda. `false` los desactiva. */
  slowMessages?: SlowMessage[] | false;
};

export type LoadingControls = {
  update: (patch: LoadingOptions) => void;
  setProgress: (value: number) => void;
  setMessage: (message: string) => void;
};

export const DEFAULT_SLOW_MESSAGES: SlowMessage[] = [
  { after: 6, text: "Esto está tardando más de lo normal…" },
  { after: 12, text: "Seguimos trabajando, espera un poco más." },
  { after: 25, text: "Es buen momento para ir por un café, aún estamos cargando." },
  { after: 45, text: "Casi listo. Gracias por tu paciencia." },
];

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Fade({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <div className={`transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}>{children}</div>;
}

function Spinner() {
  return (
    <>
      <svg
        className="feedback-loading-spinner size-12"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="20" className="stroke-[#e8e3d7]" strokeWidth="4" />
        <path
          d="M44 24a20 20 0 0 0-20-20"
          className="stroke-orange-500"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <style>{`
        @keyframes feedback-loading-spin {
          to { transform: rotate(360deg); }
        }

        .feedback-loading-spinner {
          animation: feedback-loading-spin 0.85s linear infinite !important;
          transform-origin: center;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .feedback-loading-spinner {
            animation-duration: 1.2s !important;
            animation-iteration-count: infinite !important;
          }
        }
      `}</style>
    </>
  );
}

export function LoadingView({ options }: { options: LoadingOptions }) {
  const {
    variant = "spinner",
    title = "Procesando",
    subtitle,
    message,
    progress,
    slowMessages = DEFAULT_SLOW_MESSAGES,
  } = options;

  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    const start = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  // El aviso vigente es el último cuyo umbral ya pasó.
  const slowText = slowMessages
    ? [...slowMessages]
        .sort((a, b) => a.after - b.after)
        .reduce<string | undefined>((acc, item) => (elapsed >= item.after ? item.text : acc), undefined)
    : undefined;

  const determinate = typeof progress === "number";
  const pct = determinate ? Math.min(100, Math.max(0, Math.round(progress))) : 0;

  return (
    <div
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label={title}
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-neutral-950/40 p-4 backdrop-blur-[2px] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-7 py-8 text-center shadow-xl transition-all duration-200 ${
          visible ? "scale-100" : "scale-95"
        }`}
      >
        {variant === "spinner" && (
          <div className="mb-5 flex justify-center">
            <Spinner />
          </div>
        )}

        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}

        {variant === "progress" && (
          <div className="mt-6">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={determinate ? pct : undefined}
              className="relative h-2 overflow-hidden rounded-full bg-neutral-100"
            >
              {determinate ? (
                <div
                  className="h-full rounded-full bg-neutral-950 transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              ) : (
                <div
                  className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-neutral-950"
                  style={{ animation: "fb-indeterminate 1.4s ease-in-out infinite" }}
                />
              )}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-neutral-500">
              <span className="truncate text-left">{message ?? ""}</span>
              {determinate && <span className="font-medium tabular-nums text-neutral-700">{pct}%</span>}
            </div>
            <style>{`@keyframes fb-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
          </div>
        )}

        {variant === "spinner" && message && <p className="mt-3 text-sm text-neutral-600">{message}</p>}

        {slowText && (
          <Fade key={slowText}>
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-800">
              <Clock className="mt-0.5 size-3.5 shrink-0" />
              <span>{slowText}</span>
            </div>
          </Fade>
        )}

        {elapsed >= 5 && (
          <p className="mt-4 text-xs tabular-nums text-neutral-400">Tiempo transcurrido {formatElapsed(elapsed)}</p>
        )}
      </div>
    </div>
  );
}