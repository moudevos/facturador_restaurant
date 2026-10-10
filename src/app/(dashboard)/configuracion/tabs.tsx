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
      <div role="tablist" aria-label="Secciones de configuración" className="flex min-w-max gap-1 rounded-[14px] bg-[#e9e4d6] p-1">
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
              className={`inline-flex items-center gap-2 rounded-[11px] px-3.5 py-2.5 text-sm font-bold transition-colors ${
                isActive
                  ? "bg-white text-[#14201b] shadow-sm"
                  : "text-[#7b8680] hover:text-[#14201b]"
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