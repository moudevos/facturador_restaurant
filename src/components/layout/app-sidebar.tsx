import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  Package,
  PlusCircle,
  ReceiptText,
  Settings,
} from "lucide-react";

const NAVIGATION = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ventas", label: "Nueva venta", icon: PlusCircle },
  { href: "/comprobantes", label: "Comprobantes", icon: FileText },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/egresos", label: "Egresos", icon: ReceiptText },
  { href: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function AppSidebar() {
  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r bg-white p-4 lg:block">
      <div className="mb-6 px-3 py-2">
        <p className="text-sm font-semibold">Facturador</p>
        <p className="text-xs text-neutral-500">Restaurant</p>
      </div>
      <nav className="space-y-1">
        {NAVIGATION.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
