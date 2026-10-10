"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ProductForm } from "./product-form";
import type { ProductActionResult } from "../server/actions";

export function ProductCreateModal({ open, isSaving, onClose, onCreate, onCreated }: { open: boolean; isSaving: boolean; onClose: () => void; onCreate: (formData: FormData) => Promise<ProductActionResult>; onCreated: (message: string) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button");
    focusable?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [isSaving, onClose, open]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-950/40 p-0 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}><div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="new-product-title" aria-describedby="new-product-description" className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-neutral-100 bg-white px-5 py-4 sm:px-6"><div><h2 id="new-product-title" className="text-lg font-semibold text-neutral-900">Nuevo producto</h2><p id="new-product-description" className="mt-1 text-sm text-neutral-500">Registra un producto para tus ventas y comprobantes.</p></div><button type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar formulario de nuevo producto" className="inline-flex size-10 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"><X className="size-5" aria-hidden="true" /></button></div><div className="p-5 sm:p-6"><ProductForm onCreate={onCreate} onSuccess={onCreated} onCancel={onClose} isSaving={isSaving} /></div></div></div>;
}
