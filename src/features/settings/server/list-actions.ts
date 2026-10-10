"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  Branch,
  DocumentSequence,
  OrganizationMember,
  SettingsListResult,
} from "../types";

type Membership = {
  organization_id: string;
  role: "owner" | "cashier";
};

async function currentMembership(): Promise<Membership | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  if (error || !data?.[0]) return null;
  return data[0] as Membership;
}

export async function listBranchesAction(): Promise<SettingsListResult<Branch>> {
  const membership = await currentMembership();
  if (!membership) return { data: [], errorMessage: "No tienes una organización activa." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id, code, name, address, ubigeo, active")
    .eq("organization_id", membership.organization_id)
    .order("name");

  if (error) return { data: [], errorMessage: "No pudimos cargar los locales." };
  return { data: (data ?? []) as Branch[], errorMessage: null };
}

export async function listSequencesAction(): Promise<SettingsListResult<DocumentSequence>> {
  const membership = await currentMembership();
  if (!membership) return { data: [], errorMessage: "No tienes una organización activa." };
  if (membership.role !== "owner") {
    return { data: [], errorMessage: "La administración de series está reservada a propietarios." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_sequences")
    .select("id, branch_id, document_type, series, current_value, active")
    .eq("organization_id", membership.organization_id)
    .order("document_type")
    .order("series");

  if (error) return { data: [], errorMessage: "No pudimos cargar las series." };
  return { data: (data ?? []) as DocumentSequence[], errorMessage: null };
}

export async function listMembersAction(): Promise<SettingsListResult<OrganizationMember>> {
  const membership = await currentMembership();
  if (!membership) return { data: [], errorMessage: "No tienes una organización activa." };
  if (membership.role !== "owner") {
    return { data: [], errorMessage: "La administración de usuarios está reservada a propietarios." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_organization_members", {
    p_organization_id: membership.organization_id,
  });

  if (error) return { data: [], errorMessage: "No pudimos cargar los usuarios." };
  return { data: (data ?? []) as OrganizationMember[], errorMessage: null };
}
