export const TAB_IDS = ["empresa", "locales", "series", "usuarios", "integraciones"] as const;
export type TabId = (typeof TAB_IDS)[number];

export function parseTab(value: unknown): TabId {
  return TAB_IDS.find((id) => id === value) ?? "empresa";
}