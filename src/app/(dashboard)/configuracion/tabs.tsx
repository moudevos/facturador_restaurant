"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Building2, KeyRound, MapPin, ReceiptText, Users } from "lucide-react";

import type { TabId } from "./tab-ids";

const TABS = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "locales", label: "Locales", icon: MapPin },
  { id: "series", label: "Series", icon: ReceiptText },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "integraciones", label: "Integraciones", icon: KeyRound },
] as const;

const TabsContext = createContext<{ tab: TabId; setTab: (id: TabId) => void } | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Debe usarse dentro de <TabsProvider>.");
  return ctx;
}

export function TabsProvider({ defaultTab, children }: { defaultTab: TabId; children: React.ReactNode }) {
  const [tab, setTabState] = useState<TabId>(defaultTab);

  const setTab = useCallback((id: TabId) => {
    setTabState(id);
    // Actualiza la URL sin navegar ni pedir nada al servidor
    window.history.replaceState(null, "", `/configuracion?tab=${id}`);
  }, []);

  return <TabsContext.Provider value={{ tab, setTab }}>{children}</TabsContext.Provider>;
}

export function TabsNav() {
  const { tab, setTab } = useTabs();

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div role="tablist" aria-label="Secciones de configuración" className="flex min-w-max gap-1 border-b border-neutral-200">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === tab;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-neutral-950 text-neutral-950"
                  : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ id, children }: { id: TabId; children: React.ReactNode }) {
  const { tab } = useTabs();
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id}>
      {children}
    </div>
  );
}

/** Envía la pestaña activa a la Server Action para volver a ella tras guardar. */
export function TabInput() {
  const { tab } = useTabs();
  return <input type="hidden" name="tab" value={tab} />;
}