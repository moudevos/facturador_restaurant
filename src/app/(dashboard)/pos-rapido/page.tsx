import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";

import { QuickPos } from "@/features/restaurant/components/quick-pos";
import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

export default async function PosRapidoPage() {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");
  const supabase = await createClient();

  const [sessions, products, categories, addons, discounts, methods, customers, preferences] =
    await Promise.all([
      supabase.from("v_sales_session_summary")
        .select("session_id,branch_id")
        .eq("organization_id", context.organizationId)
        .eq("status", "open")
        .order("opened_at")
        .limit(1),
      supabase.from("v_restaurant_pos_products")
        .select("id,name,category_id,sale_price")
        .eq("organization_id", context.organizationId)
        .order("name"),
      supabase.from("product_categories")
        .select("id,name")
        .eq("organization_id", context.organizationId)
        .eq("active", true)
        .order("sort_order"),
      supabase.from("restaurant_product_addons")
        .select("id,product_id,name,extra_price")
        .eq("organization_id", context.organizationId)
        .eq("active", true),
      supabase.from("restaurant_discount_rules")
        .select("id,name,mode,scope,value,max_amount")
        .eq("organization_id", context.organizationId)
        .eq("active", true)
        .order("name"),
      supabase.from("restaurant_payment_methods")
        .select("id,name,kind")
        .eq("organization_id", context.organizationId)
        .eq("active", true)
        .order("sort_order"),
      supabase.from("customers")
        .select("id,name,document_number")
        .eq("organization_id", context.organizationId)
        .eq("active", true)
        .order("name")
        .limit(100),
      supabase.from("restaurant_preferences")
        .select("receipt_width_mm")
        .eq("organization_id", context.organizationId)
        .maybeSingle(),
    ]);

  const hasError = [sessions,products,categories,addons,discounts,methods,customers,preferences]
    .some((query) => query.error);

  if (!sessions.data?.length) {
    return (
      <section className="max-w-xl space-y-4 rounded-2xl border border-[#e8e3d7] bg-white p-6">
        <ShoppingCart className="size-9 text-orange-600" aria-hidden="true" />
        <h1 className="text-2xl font-extrabold text-[#14201b]">POS · Venta rápida</h1>
        <p className="text-sm text-[#63746a]">
          Para registrar ventas internas abre primero una sesión de caja diaria.
        </p>
        <Link href="/ventas" className="inline-flex min-h-11 items-center rounded-xl bg-orange-600 px-5 text-sm font-bold text-white">
          Ir a caja
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {hasError ? (
        <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          No se pudo cargar toda la configuración del POS. Comprueba que SQL 017 y 018 estén aplicados.
        </p>
      ) : null}
      <QuickPos
        sessionId={sessions.data[0].session_id}
        products={products.data ?? []}
        categories={categories.data ?? []}
        addons={addons.data ?? []}
        discounts={discounts.data ?? []}
        methods={methods.data ?? []}
        customers={customers.data ?? []}
        receiptWidth={preferences.data?.receipt_width_mm === 58 ? 58 : 80}
        canCheckout={!hasError}
      />
    </section>
  );
}
