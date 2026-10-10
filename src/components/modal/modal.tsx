"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";

import { useScrollLock } from "@/lib/use-scroll-lock";

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export type ModalSize = keyof typeof SIZES;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: string[] = [];

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  size?: ModalSize;
  footer?: ReactNode;
  children?: ReactNode;
  dismissible?: boolean;
  onBeforeClose?: () => boolean | Promise<boolean>;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  size = "md",
  footer,
  children,
  dismissible = true,
  onBeforeClose,
}: ModalProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  useScrollLock(open);

  const requestClose = useCallback(async () => {
    if (closing.current) return;

    closing.current = true;
    try {
      if (onBeforeClose && !(await onBeforeClose())) {
        panelRef.current?.focus();
        return;
      }
      onClose();
    } finally {
      closing.current = false;
    }
  }, [onBeforeClose, onClose]);

  useEffect(() => {
    if (!open) return;

    stack.push(id);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dismissible) return;
      if (stack[stack.length - 1] !== id) return;

      const active = document.activeElement;
      if (active !== document.body && !panelRef.current?.contains(active)) return;

      event.preventDefault();
      void requestClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      const index = stack.lastIndexOf(id);
      if (index >= 0) stack.splice(index, 1);
    };
  }, [dismissible, id, open, requestClose]);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const target =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;

      target.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, [open]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;

    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null || node === document.activeElement,
    );

    if (nodes.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-neutral-950/40 backdrop-blur-[2px]"
        onMouseDown={() => {
          if (dismissible) void requestClose();
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative flex max-h-[94dvh] w-full ${SIZES[size]} flex-col rounded-t-2xl border border-neutral-200 bg-white shadow-xl outline-none sm:rounded-2xl`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-neutral-100 px-5 py-4 sm:px-6 sm:py-5">
          {Icon ? (
            <div className="rounded-xl bg-neutral-100 p-2">
              <Icon className="size-5" aria-hidden="true" />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-semibold text-neutral-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-neutral-500">
                {description}
              </p>
            ) : null}
          </div>

          {dismissible ? (
            <button
              type="button"
              onClick={() => void requestClose()}
              aria-label="Cerrar modal"
              className="-mr-1.5 inline-flex size-10 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-2 rounded-b-2xl border-t border-neutral-100 bg-neutral-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

type ModalButtonVariant = "primary" | "secondary" | "danger";

const BUTTON_BASE =
  "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ModalButtonVariant, string> = {
  primary: "bg-neutral-950 text-white hover:bg-neutral-800 focus-visible:ring-neutral-300",
  secondary: "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 focus-visible:ring-neutral-300",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300",
};

export function ModalButton({
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ModalButtonVariant }) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
