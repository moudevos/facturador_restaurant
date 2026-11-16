"use client";

import { Printer } from "lucide-react";

export function PrintTicketButton() {
  return (
    <button type="button" onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white print:hidden">
      <Printer className="size-4" aria-hidden="true" />
      Imprimir ticket interno
    </button>
  );
}
