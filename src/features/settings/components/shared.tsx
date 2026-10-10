import type { ReactNode } from "react";

export const SETTINGS_INPUT =
  "mt-1.5 h-12 w-full rounded-[13px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-sm text-[#14201b] outline-none transition placeholder:text-[#9b9f99] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-[#f6f3ec] disabled:text-[#7b8680]";

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
        active ? "bg-[#dff5e9] text-[#1f7f52]" : "bg-[#e9e4d6] text-[#59665f]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[#9b9f99]"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export function EmptySettingsState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[18px] border-2 border-dashed border-[#d8d2c0] bg-[#fbfaf6] px-5 py-10 text-center text-sm font-semibold text-[#7b8680]">
      {children}
    </div>
  );
}
