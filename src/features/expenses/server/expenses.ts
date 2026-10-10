import { createClient } from "@/lib/supabase/server";
import type { Branch } from "@/features/settings/types";
import {
  EXPENSES_PER_PAGE,
  type Expense,
  type ExpenseFilters,
} from "../types/expense";

export type ExpenseContext = {
  organizationId: string;
  userId: string;
  role: "owner" | "cashier";
  branchId: string | null;
  timeZone: string;
};

export async function getExpenseContext(): Promise<ExpenseContext | null> {
  const supabase = await createClient();
  const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsResult?.claims.sub;

  if (claimsError || typeof userId !== "string") return null;

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, branch_id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (
    membershipError ||
    !membership ||
    (membership.role !== "owner" && membership.role !== "cashier")
  ) {
    return null;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError || !organization) return null;

  return {
    organizationId: membership.organization_id,
    userId,
    role: membership.role,
    branchId: membership.branch_id,
    timeZone: organization.timezone ?? "America/Lima",
  };
}

export async function listExpenseBranches(context: ExpenseContext): Promise<Branch[]> {
  const supabase = await createClient();
  let request = supabase
    .from("branches")
    .select("id, code, name, address, ubigeo, active")
    .eq("organization_id", context.organizationId)
    .order("name");

  if (context.role === "cashier" && context.branchId) {
    request = request.eq("id", context.branchId);
  }

  const { data, error } = await request;
  if (error) return [];
  return (data ?? []) as Branch[];
}

function applyExpenseFilters<T extends {
  eq: (column: string, value: unknown) => T;
  gte: (column: string, value: string) => T;
  lte: (column: string, value: string) => T;
  or: (filters: string) => T;
}>(request: T, filters: ExpenseFilters): T {
  let next = request;

  if (filters.branchId) next = next.eq("branch_id", filters.branchId);
  if (filters.category) next = next.eq("category", filters.category);
  if (filters.status === "activos") next = next.eq("is_voided", false);
  if (filters.status === "anulados") next = next.eq("is_voided", true);
  if (filters.dateFrom) next = next.gte("expense_date", filters.dateFrom);
  if (filters.dateTo) next = next.lte("expense_date", filters.dateTo);

  const searchTerm = filters.query.replace(/[,()%]/g, " ").trim();
  if (searchTerm) {
    next = next.or(`description.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
  }

  return next;
}

export async function listExpenses({
  context,
  filters,
}: {
  context: ExpenseContext;
  filters: ExpenseFilters;
}) {
  const supabase = await createClient();

  let request = supabase
    .from("expenses")
    .select(
      "id, branch_id, expense_date, category, description, amount, notes, is_voided, voided_at, created_at",
      { count: "exact" },
    )
    .eq("organization_id", context.organizationId);

  request = applyExpenseFilters(request, filters);

  const from = (filters.page - 1) * EXPENSES_PER_PAGE;
  const [{ data, count, error }, { data: summary, error: summaryError }] = await Promise.all([
    request
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + EXPENSES_PER_PAGE - 1),
    supabase.rpc("expense_filtered_summary", {
      p_organization_id: context.organizationId,
      p_branch_id: filters.branchId || null,
      p_date_from: filters.dateFrom || null,
      p_date_to: filters.dateTo || null,
      p_category: filters.category || null,
      p_status:
        filters.status === "activos"
          ? "active"
          : filters.status === "anulados"
            ? "voided"
            : "all",
      p_query: filters.query || null,
    }),
  ]);

  const summaryRow = Array.isArray(summary) ? summary[0] : null;

  return {
    expenses: (data ?? []) as Expense[],
    count: count ?? 0,
    totalAmount: summaryRow?.total_amount ?? 0,
    error: error ?? summaryError,
  };
}
