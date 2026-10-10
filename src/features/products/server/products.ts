import { createClient } from "@/lib/supabase/server";
import { PRODUCTS_PER_PAGE, type Product, type ProductStatusFilter } from "../types/product";
export { PRODUCTS_PER_PAGE } from "../types/product";
export type ProductContext = { organizationId: string; userId: string; role: "owner" | "cashier" };
export async function getProductContext(): Promise<ProductContext | null> {
  const supabase = await createClient(); const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims(); const userId = claimsResult?.claims.sub;
  if (claimsError || typeof userId !== "string") return null;
  const { data: membership } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", userId).eq("active", true).limit(1).maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "cashier")) return null;
  return { organizationId: membership.organization_id, userId, role: membership.role };
}
export async function getProduct(id: string, organizationId: string): Promise<Product | null> {
  const supabase = await createClient(); const { data } = await supabase.from("products").select("id, sku, name, description, unit_code, price, tax_affectation_code, active, updated_at").eq("id", id).eq("organization_id", organizationId).maybeSingle(); return data as Product | null;
}
export async function listProducts({ organizationId, query, status, page }: { organizationId: string; query: string; status: ProductStatusFilter; page: number }) {
  const supabase = await createClient(); let request = supabase.from("products").select("id, sku, name, description, unit_code, price, tax_affectation_code, active, updated_at", { count: "exact" }).eq("organization_id", organizationId);
  if (status === "activo") request = request.eq("active", true); if (status === "inactivo") request = request.eq("active", false);
  // PostgREST usa comas y paréntesis como sintaxis dentro de `or`; no se interpolan sin normalizar.
  const searchTerm = query.replace(/[,%()]/g, " ").trim();
  if (searchTerm) request = request.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
  const from = (page - 1) * PRODUCTS_PER_PAGE; const { data, count, error } = await request.order("name", { ascending: true }).range(from, from + PRODUCTS_PER_PAGE - 1);
  return { products: (data ?? []) as Product[], count: count ?? 0, error };
}
