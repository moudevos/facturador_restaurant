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
  ReceiptText,
  Settings,
  Store,
  UsersRound,
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
      { href: "/ventas", label: "Área de venta", icon: Store },
      { href: "/comprobantes", label: "Comprobantes", icon: FileText },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/clientes", label: "Clientes", icon: UsersRound },
      { href: "/productos", label: "Productos", icon: Package },
    ],
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

const MOBILE_NAVIGATION: readonly NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/ventas", label: "Venta", icon: Store },
  { href: "/comprobantes", label: "Comprob.", icon: FileText },
  { href: "/clientes", label: "Clientes", icon: UsersRound },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/egresos", label: "Egresos", icon: ReceiptText },
] as const;

const STORAGE_KEY = "facturador:sidebar-collapsed";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  brandName = "Facturador Restaurant",
}: {
  brandName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [isSigningOut, setIsSigningOut] = useState(false);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Storage puede estar deshabilitado.
      }
      return next;
    });
  }

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

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const initial = brandName.trim().charAt(0).toUpperCase() || "R";

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[#14201b] p-3 text-white transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? "w-[76px]" : "w-[244px]"
        }`}
      >
        <div className="mb-4 flex h-14 items-center">
          <div className="flex size-12 shrink-0 items-center justify-center">
            <div className="flex size-9 items-center justify-center rounded-[11px] bg-orange-500 text-sm font-extrabold text-white">
              {initial}
            </div>
          </div>
          <div
            className={`min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 ${
              collapsed ? "w-0 opacity-0" : "w-full opacity-100"
            }`}
          >
            <p className="truncate text-sm font-extrabold leading-tight text-white">{brandName}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#9fb0a8]">Facturador Restaurant</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1" aria-label="Navegación principal">
          {NAVIGATION.map((group, index) => (
            <div key={group.title} className={index > 0 ? "pt-3" : ""}>
              {collapsed ? (
                index > 0 ? <div className="mx-3 mb-3 h-px bg-white/10" aria-hidden="true" /> : null
              ) : (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f9189]">
                  {group.title}
                </p>
              )}

              <ul className="space-y-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        aria-label={collapsed ? label : undefined}
                        className={`group relative flex h-11 items-center rounded-[14px] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${
                          active
                            ? "bg-orange-500 text-white shadow-[0_8px_20px_-10px_#e86400]"
                            : "text-[#b6c4be] hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <span className="flex size-12 shrink-0 items-center justify-center">
                          <Icon className="size-[19px]" aria-hidden="true" />
                        </span>
                        <span
                          className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                            collapsed ? "w-0 opacity-0" : "w-full opacity-100"
                          }`}
                        >
                          {label}
                        </span>
                        {collapsed ? (
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-xl bg-[#1e2d27] px-3 py-2 text-xs font-bold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
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

        <div className="space-y-1 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="group flex h-11 w-full items-center rounded-[14px] text-sm font-bold text-[#b6c4be] transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
          >
            <span className="flex size-12 shrink-0 items-center justify-center">
              {isSigningOut ? (
                <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="size-[18px]" aria-hidden="true" />
              )}
            </span>
            <span className={collapsed ? "hidden" : "truncate"}>
              {isSigningOut ? "Cerrando..." : "Cerrar sesión"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            className="flex h-11 w-full items-center rounded-[14px] text-sm font-bold text-[#7f9189] transition hover:bg-white/[0.06] hover:text-white"
          >
            <span className="flex size-12 shrink-0 items-center justify-center">
              {collapsed ? (
                <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-[18px]" aria-hidden="true" />
              )}
            </span>
            {!collapsed ? <span>Contraer menú</span> : null}
          </button>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-[62px] items-center justify-between bg-[#14201b] px-4 text-white shadow-sm lg:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-orange-500 text-sm font-extrabold">
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-extrabold leading-tight">{brandName}</span>
            <span className="mt-0.5 block truncate text-[10px] text-[#9fb0a8]">Facturador Restaurant</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/configuracion"
            aria-label="Configuración"
            className={`flex size-10 items-center justify-center rounded-xl transition ${
              isActive(pathname, "/configuracion")
                ? "bg-orange-500 text-white"
                : "text-[#b6c4be] hover:bg-white/10 hover:text-white"
            }`}
          >
            <Settings className="size-[19px]" />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label="Cerrar sesión"
            className="flex size-10 items-center justify-center rounded-xl text-[#b6c4be] transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            {isSigningOut ? (
              <LoaderCircle className="size-[18px] animate-spin" />
            ) : (
              <LogOut className="size-[18px]" />
            )}
          </button>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-[#e8e3d7] bg-white px-1 pt-1.5 pb-[calc(7px+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_-20px_rgba(20,32,27,.45)] lg:hidden"
        aria-label="Navegación móvil"
      >
        {MOBILE_NAVIGATION.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-[13px] px-0.5 py-1.5 text-[9px] font-bold transition ${
                active ? "bg-orange-50 text-orange-600" : "text-[#7b8680]"
              }`}
            >
              <Icon className="size-[20px]" aria-hidden="true" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
