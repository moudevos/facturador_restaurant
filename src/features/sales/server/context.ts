import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Branch } from "@/features/settings/types";

export type SalesContext = {
  organizationId: string;
  userId: string;
  role: "owner" | "cashier";
  memberBranchId: string | null;
  timeZone: string;
  tradeName: string;
};

export const getAuthenticatedUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;

  if (error || typeof userId !== "string") return null;
  return userId;
});

export const getSalesContext = cache(async (): Promise<SalesContext | null> => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const supabase = await createClient();

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
    .select("timezone, trade_name, legal_name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError || !organization) return null;

  return {
    organizationId: membership.organization_id,
    userId,
    role: membership.role,
    memberBranchId: membership.branch_id,
    timeZone: organization.timezone ?? "America/Lima",
    tradeName: organization.trade_name || organization.legal_name,
  };
});

export async function listAccessibleBranches(context: SalesContext): Promise<Branch[]> {
  const supabase = await createClient();
  let request = supabase
    .from("branches")
    .select("id, code, name, address, ubigeo, active")
    .eq("organization_id", context.organizationId)
    .eq("active", true)
    .order("name");

  if (context.role === "cashier" && context.memberBranchId) {
    request = request.eq("id", context.memberBranchId);
  }

  const { data, error } = await request;
  if (error) return [];
  return (data ?? []) as Branch[];
}
