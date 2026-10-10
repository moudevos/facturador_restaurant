"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bell, Check, TriangleAlert, X, type LucideIcon } from "lucide-react";
   import { LoadingView, type LoadingControls, type LoadingOptions } from "./loading-view";


/* ───────────── Tipos públicos ───────────── */

export type Tone = "success" | "info" | "warning" | "danger";
export type ToastPosition = "top-left" | "bottom-center";

export type ToastOptions = {
  description?: string;
  tone?: Tone;
  /** Por defecto "top-left". */
  position?: ToastPosition;
  /** Milisegundos. 0 = no se cierra solo. Por defecto 4500. */
  duration?: number;
};

export type DialogOptions = {
  title: string;
  description?: string;
  /** info (defecto) | success | warning | danger */
  tone?: Tone;
  confirmText?: string;
  cancelText?: string;
};

type ToastFn = {
  (title: string, options?: ToastOptions): void;
  success: (title: string, options?: Omit<ToastOptions, "tone">) => void;
  info: (title: string, options?: Omit<ToastOptions, "tone">) => void;
  warning: (title: string, options?: Omit<ToastOptions, "tone">) => void;
  error: (title: string, options?: Omit<ToastOptions, "tone">) => void;
};

type AlertFn = {
  (options: DialogOptions): Promise<void>;
  success: (options: Omit<DialogOptions, "tone">) => Promise<void>;
  info: (options: Omit<DialogOptions, "tone">) => Promise<void>;
  warning: (options: Omit<DialogOptions, "tone">) => Promise<void>;
  error: (options: Omit<DialogOptions, "tone">) => Promise<void>;
};

type FeedbackApi = {
  toast: ToastFn;
  /** Mini modal de confirmación. Resuelve true si acepta, false si cancela. */
  confirm: (options: DialogOptions) => Promise<boolean>;
  /** Modal de alerta centrado (éxito, error, advertencia, info) con un solo botón. */
  alert: AlertFn;
  /** Acepta un texto (se usa como título) o un objeto con todas las opciones. */
  showLoading: (options?: LoadingOptions | string) => void;
  /** Actualiza progreso, mensaje, título, etc. mientras el loading está visible. */
  updateLoading: (patch: LoadingOptions) => void;
  hideLoading: () => void;
  /** Muestra el loading mientras dura la promesa y lo oculta siempre al terminar. */
  withLoading: <T>(
    task: (controls: LoadingControls) => Promise<T>,
    options?: LoadingOptions | string,
  ) => Promise<T>;
};

/* ───────────── Estilos por tono ───────────── */

type ToneStyle = {
  glyph: LucideIcon;
  /** Fondo + borde del toast */
  toast: string;
  toastTitle: string;
  toastDesc: string;
  toastClose: string;
  /** Círculo sólido (toast) */
  solid: string;
  /** Círculo suave (modales) */
  soft: string;
  /** Halo exterior del ícono grande en la alerta */
  halo: string;
  button: string;
};

const TONES: Record<Tone, ToneStyle> = {
  success: {
    glyph: Check,
    toast: "border-emerald-200 bg-emerald-50",
    toastTitle: "text-emerald-950",
    toastDesc: "text-emerald-800",
    toastClose: "text-emerald-700/60 hover:bg-emerald-100 hover:text-emerald-900",
    solid: "bg-emerald-500 text-white",
    soft: "bg-emerald-100 text-emerald-600",
    halo: "ring-emerald-50",
    button: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300",
  },
  info: {
    glyph: Bell,
    toast: "border-sky-200 bg-sky-50",
    toastTitle: "text-sky-950",
    toastDesc: "text-sky-800",
    toastClose: "text-sky-700/60 hover:bg-sky-100 hover:text-sky-900",
    solid: "bg-sky-500 text-white",
    soft: "bg-sky-100 text-sky-600",
    halo: "ring-sky-50",
    button: "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-300",
  },
  warning: {
    glyph: TriangleAlert,
    toast: "border-amber-200 bg-amber-50",
    toastTitle: "text-amber-950",
    toastDesc: "text-amber-800",
    toastClose: "text-amber-700/60 hover:bg-amber-100 hover:text-amber-900",
    solid: "bg-amber-500 text-white",
    soft: "bg-amber-100 text-amber-600",
    halo: "ring-amber-50",
    button: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-300",
  },
  danger: {
    glyph: X,
    toast: "border-red-200 bg-red-50",
    toastTitle: "text-red-950",
    toastDesc: "text-red-800",
    toastClose: "text-red-700/60 hover:bg-red-100 hover:text-red-900",
    solid: "bg-red-500 text-white",
    soft: "bg-red-100 text-red-600",
    halo: "ring-red-50",
    button: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-300",
  },
};

/* ───────────── Contexto ───────────── */

type ToastData = {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
  position: ToastPosition;
  duration: number;
};

type DialogRequest = DialogOptions & {
  id: number;
  kind: "confirm" | "alert";
  resolve: (value: boolean) => void;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback debe usarse dentro de <FeedbackProvider>.");
  return ctx;
}

/* ───────────── Provider ───────────── */

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [loading, setLoading] = useState<{ count: number; options: LoadingOptions }>({
    count: 0,
    options: {},
  });
  const nextId = useRef(0);

  /* Toasts */
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useMemo<ToastFn>(() => {
    const base = (title: string, options: ToastOptions = {}) => {
      const id = ++nextId.current;
      setToasts((prev) => [
        ...prev.slice(-4),
        {
          id,
          title,
          description: options.description,
          tone: options.tone ?? "info",
          position: options.position ?? "top-left",
          duration: options.duration ?? 4500,
        },
      ]);
    };

    return Object.assign(base, {
      success: (title: string, o?: Omit<ToastOptions, "tone">) => base(title, { ...o, tone: "success" }),
      info: (title: string, o?: Omit<ToastOptions, "tone">) => base(title, { ...o, tone: "info" }),
      warning: (title: string, o?: Omit<ToastOptions, "tone">) => base(title, { ...o, tone: "warning" }),
      error: (title: string, o?: Omit<ToastOptions, "tone">) => base(title, { ...o, tone: "danger" }),
    });
  }, []);

  /* Diálogos (se encolan: si hay uno abierto, el siguiente espera) */
  const confirm = useCallback(
    (options: DialogOptions) =>
      new Promise<boolean>((resolve) => {
        const id = ++nextId.current;
        setQueue((q) => [...q, { ...options, id, kind: "confirm", resolve }]);
      }),
    [],
  );

  const alert = useMemo<AlertFn>(() => {
    const base = (options: DialogOptions) =>
      new Promise<void>((resolve) => {
        const id = ++nextId.current;
        setQueue((q) => [...q, { ...options, id, kind: "alert", resolve: () => resolve() }]);
      });

    return Object.assign(base, {
      success: (o: Omit<DialogOptions, "tone">) => base({ ...o, tone: "success" }),
      info: (o: Omit<DialogOptions, "tone">) => base({ ...o, tone: "info" }),
      warning: (o: Omit<DialogOptions, "tone">) => base({ ...o, tone: "warning" }),
      error: (o: Omit<DialogOptions, "tone">) => base({ ...o, tone: "danger" }),
    });
  }, []);

  const current = queue[0];

  const settle = useCallback(
    (result: boolean) => {
      if (!current) return;
      current.resolve(result);
      setQueue((q) => q.slice(1));
    },
    [current],
  );

  /* Loading (con contador para soportar llamadas anidadas) */
  const showLoading = useCallback((input?: LoadingOptions | string) => {
    const options: LoadingOptions = typeof input === "string" ? { title: input } : (input ?? {});
    setLoading((s) => ({ count: s.count + 1, options }));
  }, []);

  const updateLoading = useCallback((patch: LoadingOptions) => {
    setLoading((s) => (s.count === 0 ? s : { ...s, options: { ...s.options, ...patch } }));
  }, []);

  const hideLoading = useCallback(() => {
    setLoading((s) => (s.count <= 1 ? { count: 0, options: {} } : { ...s, count: s.count - 1 }));
  }, []);

  const withLoading = useCallback(
    async <T,>(task: (controls: LoadingControls) => Promise<T>, input?: LoadingOptions | string) => {
      showLoading(input);
      const controls: LoadingControls = {
        update: updateLoading,
        setProgress: (value) => updateLoading({ progress: value }),
        setMessage: (message) => updateLoading({ message }),
      };
      try {
        return await task(controls);
      } finally {
        hideLoading();
      }
    },
    [showLoading, updateLoading, hideLoading],
  );
  /* Bloquea el scroll del fondo mientras haya modal */
  const locked = queue.length > 0 || loading.count > 0;
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);

 const api = useMemo<FeedbackApi>(
  () => ({ toast, confirm, alert, showLoading, updateLoading, hideLoading, withLoading }),
  [toast, confirm, alert, showLoading, updateLoading, hideLoading, withLoading],
);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      {current &&
        (current.kind === "alert" ? (
          <AlertView key={current.id} request={current} onSettle={settle} />
        ) : (
          <ConfirmView key={current.id} request={current} onSettle={settle} />
        ))}
      {loading.count > 0 && <LoadingView options={loading.options} />}
    </FeedbackContext.Provider>
  );
}

/* ───────────── Toasts ───────────── */

function ToastViewport({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: number) => void }) {
  const topLeft = toasts.filter((t) => t.position === "top-left");
  const bottomCenter = toasts.filter((t) => t.position === "bottom-center");

  return (
    <>
      <div
        aria-live="polite"
        className="pointer-events-none fixed left-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {topLeft.map((t) => (
          <ToastItem key={t.id} data={t} onDismiss={onDismiss} />
        ))}
      </div>
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2"
      >
        {bottomCenter.map((t) => (
          <ToastItem key={t.id} data={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

function ToastItem({ data, onDismiss }: { data: ToastData; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const closing = useRef(false);
  const style = TONES[data.tone];
  const Glyph = style.glyph;

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setVisible(false);
    window.setTimeout(() => onDismiss(data.id), 200);
  }, [data.id, onDismiss]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (data.duration <= 0) return;
    const timer = window.setTimeout(close, data.duration);
    return () => window.clearTimeout(timer);
  }, [data.duration, close]);

  const hiddenState = data.position === "top-left" ? "-translate-x-3 opacity-0" : "translate-y-3 opacity-0";

  return (
    <div
      role={data.tone === "danger" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg shadow-neutral-900/5 transition-all duration-200 ${style.toast} ${visible ? "translate-x-0 translate-y-0 opacity-100" : hiddenState
        }`}
    >
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${style.solid}`}>
        <Glyph className="size-4" strokeWidth={2.75} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={`text-sm font-semibold ${style.toastTitle}`}>{data.title}</p>
        {data.description && <p className={`mt-0.5 text-sm ${style.toastDesc}`}>{data.description}</p>}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Cerrar"
        className={`rounded-md p-1 transition ${style.toastClose}`}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/* ───────────── Hook compartido por los modales ───────────── */

function useDialogLifecycle(onCancel: () => void, focusRef: React.RefObject<HTMLButtonElement | null>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    focusRef.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, [focusRef]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return visible;
}

/* ───────────── Modal de alerta (centrado, tipo SweetAlert) ───────────── */

function AlertView({ request, onSettle }: { request: DialogRequest; onSettle: (result: boolean) => void }) {
  const tone = request.tone ?? "info";
  const style = TONES[tone];
  const Glyph = style.glyph;
  const titleId = useId();
  const okRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => onSettle(true), [onSettle]);
  const visible = useDialogLifecycle(close, okRef);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"
          }`}
        onClick={close}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white px-6 pb-6 pt-8 text-center shadow-xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
      >
        <div
          className={`mx-auto flex size-16 items-center justify-center rounded-full ring-8 ${style.soft} ${style.halo}`}
        >
          <Glyph className="size-8" strokeWidth={2.5} />
        </div>

        <h2 id={titleId} className="mt-6 text-lg font-semibold text-neutral-900">
          {request.title}
        </h2>
        {request.description && (
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{request.description}</p>
        )}

        <button
          ref={okRef}
          type="button"
          onClick={close}
          className={`mt-6 inline-flex h-10 min-w-28 items-center justify-center rounded-lg px-5 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 ${style.button}`}
        >
          {request.confirmText ?? "Entendido"}
        </button>
      </div>
    </div>
  );
}

/* ───────────── Mini modal de confirmación ───────────── */

function ConfirmView({ request, onSettle }: { request: DialogRequest; onSettle: (result: boolean) => void }) {
  const tone = request.tone ?? "info";
  const style = TONES[tone];
  const Glyph = style.glyph;
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancel = useCallback(() => onSettle(false), [onSettle]);
  // En acciones peligrosas el foco inicial va a "Cancelar" por seguridad.
  const visible = useDialogLifecycle(cancel, tone === "danger" ? cancelRef : confirmRef);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px] transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"
          }`}
        onClick={cancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl transition-all duration-200 ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
      >
        <div className="flex items-start gap-4">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${style.soft}`}>
            <Glyph className="size-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-base font-semibold text-neutral-900">
              {request.title}
            </h2>
            {request.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{request.description}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
          >
            {request.cancelText ?? "Cancelar"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onSettle(true)}
            className={`inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 ${style.button}`}
          >
            {request.confirmText ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
