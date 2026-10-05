"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ReceiptText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string; items: readonly NavItem[] };

const NAVIGATION: readonly NavGroup[] = [
  {
    title: "General",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Ventas",
    items: [
      { href: "/ventas", label: "Nueva venta", icon: PlusCircle },
      { href: "/comprobantes", label: "Comprobantes", icon: FileText },
    ],
  },
  {
    title: "Catálogo",
    items: [{ href: "/productos", label: "Productos", icon: Package }],
  },
  {
    title: "Finanzas",
    items: [{ href: "/egresos", label: "Egresos", icon: ReceiptText }],
  },
  {
    title: "Sistema",
    items: [{ href: "/configuracion", label: "Configuración", icon: Settings }],
  },
] as const;

const STORAGE_KEY = "ara-burger:sidebar-collapsed";

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Recupera la preferencia guardada
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignorar */
      }
      return next;
    });
  }

  // Atajo: Ctrl/Cmd + B
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-neutral-200 bg-white p-3 transition-[width] duration-200 ease-out lg:flex ${collapsed ? "w-[72px]" : "w-64"
        }`}
    >
      {/* Marca */}
      <div className="mb-4 flex h-12 items-center">
        <div className="flex size-12 shrink-0 items-center justify-center">
          <div className="flex size-9 items-center justify-center rounded-xl bg-neutral-900 text-sm font-bold text-white">
            A
          </div>
        </div>
        <div
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-full opacity-100"
            }`}
        >
          <p className="truncate text-sm font-semibold leading-tight text-neutral-900">Ara Burger</p>
          <p className="truncate text-xs text-neutral-500">Facturador Restaurant</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 space-y-1" aria-label="Navegación principal">
        {NAVIGATION.map((group, index) => (
          <div key={group.title} className={index > 0 ? "pt-3" : ""}>
            {collapsed ? (
              index > 0 ? <div className="mx-3 mb-3 h-px bg-neutral-200" aria-hidden="true" /> : null
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                {group.title}
              </p>
            )}

            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? label : undefined}
                      className={`group relative flex h-10 items-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 ${active
                        ? "bg-neutral-100 text-neutral-950"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950"
                        }`}
                    >
                      {active ? (
                        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-neutral-900" aria-hidden="true" />
                      ) : null}

                      <span className="flex size-12 shrink-0 items-center justify-center">
                        <Icon
                          className={`size-[18px] transition-colors ${active ? "text-neutral-900" : "text-neutral-500 group-hover:text-neutral-900"
                            }`}
                          aria-hidden="true"
                        />
                      </span>

                      <span
                        className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-full opacity-100"
                          }`}
                      >
                        {label}
                      </span>

                      {collapsed ? (
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                        >
                          {label}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pie: contraer / expandir */}
      {/* Pie: cerrar sesión + contraer / expandir */}
      <div className="space-y-0.5 border-t border-neutral-200 pt-3">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-label="Cerrar sesión"
          className="group relative flex h-10 w-full items-center rounded-lg text-sm font-medium text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex size-12 shrink-0 items-center justify-center">
            {isSigningOut ? (
              <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-[18px]" aria-hidden="true" />
            )}
          </span>
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-full opacity-100"
              }`}
          >
            {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </span>

          {collapsed ? (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              Cerrar sesión
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          aria-expanded={!collapsed}
          className="group relative flex h-10 w-full items-center rounded-lg text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
        >
          <span className="flex size-12 shrink-0 items-center justify-center">
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-[18px]" aria-hidden="true" />
            )}
          </span>
          <span
            className={`flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap pr-3 transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-full opacity-100"
              }`}
          >
            Contraer menú
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              Ctrl B
            </kbd>
          </span>

          {collapsed ? (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              Expandir menú
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}