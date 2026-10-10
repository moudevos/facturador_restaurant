import type { ReactNode } from "react";

export const SETTINGS_INPUT =
  "mt-1.5 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500";

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-neutral-400"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export function EmptySettingsState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-10 text-center text-sm text-neutral-500">
      {children}
    </div>
  );
}
