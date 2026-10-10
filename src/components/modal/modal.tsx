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
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#14201b]/55 backdrop-blur-[2px]"
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
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-[#e8e3d7] bg-[#f6f3ec] shadow-2xl outline-none sm:max-h-[88dvh] sm:rounded-[28px] ${SIZES[size]}`}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-[#cfcabb] sm:hidden" />

        <div className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-5">
          {Icon ? (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-orange-50 text-orange-600">
              <Icon className="size-5" aria-hidden="true" />
            </div>
          ) : null}

          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-[18px] font-extrabold tracking-[-0.01em] text-[#14201b]">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-[#7b8680] sm:text-sm">
                {description}
              </p>
            ) : null}
          </div>

          {dismissible ? (
            <button
              type="button"
              onClick={() => void requestClose()}
              aria-label="Cerrar modal"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[#e8e3d7] bg-white text-[#7b8680] transition hover:text-[#14201b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">
          {children}
        </div>

        {footer ? (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#e8e3d7] bg-[#f6f3ec] px-5 py-4 sm:flex-row sm:justify-end sm:rounded-b-[28px] sm:px-6">
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
  "inline-flex h-12 items-center justify-center rounded-[15px] px-5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ModalButtonVariant, string> = {
  primary:
    "bg-orange-500 text-white shadow-[0_8px_20px_-10px_#e86400] hover:bg-orange-600 focus-visible:ring-orange-300",
  secondary:
    "border border-[#e8e3d7] bg-white text-[#14201b] hover:bg-[#fbfaf6] focus-visible:ring-[#d8d2c0]",
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
