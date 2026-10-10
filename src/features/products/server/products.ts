import { createClient } from "@/lib/supabase/server";
import {
  PRODUCTS_PER_PAGE,
  type Product,
  type ProductCategory,
  type ProductStatusFilter,
} from "../types/product";

export { PRODUCTS_PER_PAGE } from "../types/product";

export type ProductContext = {
  organizationId: string;
  userId: string;
  role: "owner" | "cashier";
};

const PRODUCT_SELECT =
  "id, product_code, sku, name, description, category_id, sunat_product_code, unit_code, price, tax_affectation_code, active, updated_at, category:product_categories!products_category_fk(id, code, name, active, sort_order)";

export async function getProductContext(): Promise<ProductContext | null> {
  const supabase = await createClient();
  const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsResult?.claims.sub;

  if (claimsError || typeof userId !== "string") return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!membership || (membership.role !== "owner" && membership.role !== "cashier")) {
    return null;
  }

  return {
    organizationId: membership.organization_id,
    userId,
    role: membership.role,
  };
}

function normalizeProductRow(row: Record<string, unknown>): Product {
  const category = row.category;
  return {
    ...row,
    category: Array.isArray(category) ? (category[0] ?? null) : (category ?? null),
  } as unknown as Product;
}

export async function getProduct(
  id: string,
  organizationId: string,
): Promise<Product | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data ? normalizeProductRow(data as unknown as Record<string, unknown>) : null;
}

export async function listProductCategories(
  organizationId: string,
  activeOnly = true,
): Promise<ProductCategory[]> {
  const supabase = await createClient();
  let request = supabase
    .from("product_categories")
    .select("id, code, name, active, sort_order")
    .eq("organization_id", organizationId)
    .order("sort_order")
    .order("name");

  if (activeOnly) request = request.eq("active", true);

  const { data, error } = await request;
  if (error) return [];
  return (data ?? []) as ProductCategory[];
}

export async function listProducts({
  organizationId,
  query,
  status,
  categoryId,
  page,
}: {
  organizationId: string;
  query: string;
  status: ProductStatusFilter;
  categoryId: string;
  page: number;
}) {
  const supabase = await createClient();
  let request = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    .eq("organization_id", organizationId);

  if (status === "activo") request = request.eq("active", true);
  if (status === "inactivo") request = request.eq("active", false);
  if (categoryId) request = request.eq("category_id", categoryId);

  const searchTerm = query.replace(/[,%()]/g, " ").trim();
  if (searchTerm) {
    request = request.or(
      `name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`,
    );
  }

  const from = (page - 1) * PRODUCTS_PER_PAGE;
  const { data, count, error } = await request
    .order("name", { ascending: true })
    .range(from, from + PRODUCTS_PER_PAGE - 1);

  return {
    products: (data ?? []).map((row) =>
      normalizeProductRow(row as unknown as Record<string, unknown>),
    ),
    count: count ?? 0,
    error,
  };
}
