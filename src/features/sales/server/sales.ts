import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/features/products/types/product";
import type { CashMovement, Customer, RecentSale, SalesSessionSummary } from "../types/sales";
import type { SalesContext } from "./context";

export async function getOpenSession(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_sales_session_summary")
    .select("*")
    .eq("branch_id", branchId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  return {
    session: error ? null : (data as SalesSessionSummary | null),
    error,
  };
}

export async function listSessionHistory(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_sales_session_summary")
    .select("*")
    .eq("branch_id", branchId)
    .eq("status", "closed")
    .order("opened_at", { ascending: false })
    .limit(30);

  return {
    sessions: error ? [] : ((data ?? []) as SalesSessionSummary[]),
    error,
  };
}

export async function listSessionMovements(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_movements")
    .select("id, movement_type, reason_code, description, amount, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(30);

  return { movements: error ? [] : ((data ?? []) as CashMovement[]), error };
}

export async function listRecentSessionSales(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales")
    .select("id, series, correlative, customer_name, total_amount, created_at, sale_payments(payment_method)")
    .eq("session_id", sessionId)
    .neq("status", "voided")
    .order("created_at", { ascending: false })
    .limit(12);

  const sales: RecentSale[] = (data ?? []).map((row) => {
    const payments = Array.isArray(row.sale_payments) ? row.sale_payments : [];
    const first = payments[0] as { payment_method?: RecentSale["payment_method"] } | undefined;
    return {
      id: row.id,
      series: row.series,
      correlative: row.correlative,
      customer_name: row.customer_name,
      total_amount: row.total_amount,
      created_at: row.created_at,
      payment_method: first?.payment_method ?? null,
    };
  });

  return { sales: error ? [] : sales, error };
}

export async function listActiveProducts(context: SalesContext): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, product_code, sku, name, description, category_id, sunat_product_code, unit_code, price, tax_affectation_code, active, updated_at, category:product_categories!products_category_fk(id, code, name, active, sort_order)")
    .eq("organization_id", context.organizationId)
    .eq("active", true)
    .order("name")
    .limit(300);

  if (error) return [];
  return (data ?? []).map((row) => ({
    ...row,
    category: Array.isArray(row.category)
      ? (row.category[0] ?? null)
      : (row.category ?? null),
  })) as unknown as Product[];
}

export async function listActiveCustomers(context: SalesContext): Promise<Customer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, document_type, document_number, name, phone, email, address, active")
    .eq("organization_id", context.organizationId)
    .eq("active", true)
    .order("name")
    .limit(200);

  if (error) return [];
  return (data ?? []) as Customer[];
}

export async function listActiveSequences(branchId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_sequences")
    .select("id, document_type, series, current_value")
    .eq("branch_id", branchId)
    .eq("active", true)
    .order("document_type")
    .order("series");

  return { sequences: error ? [] : (data ?? []), error };
}

export async function listCashiers(context: SalesContext, branchId: string) {
  const supabase = await createClient();

  if (context.role === "cashier") {
    const { data } = await supabase.rpc("list_organization_members", {
      p_organization_id: context.organizationId,
    });
    const self = (data ?? []).find((row: { user_id: string }) => row.user_id === context.userId);
    return self ? [self] : [{ user_id: context.userId, email: "Cajero actual", role: "cashier", branch_id: context.memberBranchId, active: true }];
  }

  const { data, error } = await supabase.rpc("list_organization_members", {
    p_organization_id: context.organizationId,
  });

  if (error) return [];

  return (data ?? []).filter(
    (row: { active: boolean; branch_id: string | null }) =>
      row.active && (row.branch_id === null || row.branch_id === branchId),
  );
}
