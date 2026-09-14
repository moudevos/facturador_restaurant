"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid("Identificador inválido.");
const ruc = z.string().regex(/^\d{11}$/, "El RUC debe contener 11 dígitos.");
const optionalText = z.string().trim().optional().transform((value) => value || null);

function go(kind: "success" | "error", message: string): never {
  redirect(`/configuracion?${kind}=${encodeURIComponent(message)}`);
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

export async function initializeOrganizationAction(formData: FormData) {
  const schema = z.object({
    legalName: z.string().trim().min(2, "Ingresa la razón social."),
    tradeName: optionalText,
    ruc,
    branchName: z.string().trim().min(2, "Ingresa el nombre del local."),
    branchAddress: optionalText,
    branchUbigeo: optionalText,
  });

  const parsed = schema.safeParse({
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName"),
    ruc: formData.get("ruc"),
    branchName: formData.get("branchName"),
    branchAddress: formData.get("branchAddress"),
    branchUbigeo: formData.get("branchUbigeo"),
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("initialize_organization", {
    p_legal_name: parsed.data.legalName,
    p_trade_name: parsed.data.tradeName,
    p_ruc: parsed.data.ruc,
    p_branch_name: parsed.data.branchName,
    p_branch_address: parsed.data.branchAddress,
    p_branch_ubigeo: parsed.data.branchUbigeo,
    p_timezone: "America/Lima",
  });

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Empresa, local principal y serie B001 creados correctamente.");
}

export async function updateOrganizationAction(formData: FormData) {
  const schema = z.object({
    organizationId: uuid,
    legalName: z.string().trim().min(2, "Ingresa la razón social."),
    tradeName: optionalText,
    ruc,
    timezone: z.string().trim().min(1, "Selecciona una zona horaria."),
  });

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    legalName: formData.get("legalName"),
    tradeName: formData.get("tradeName"),
    ruc: formData.get("ruc"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      legal_name: parsed.data.legalName,
      trade_name: parsed.data.tradeName,
      ruc: parsed.data.ruc,
      timezone: parsed.data.timezone,
    })
    .eq("id", parsed.data.organizationId);

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Datos de la empresa actualizados.");
}

export async function createBranchAction(formData: FormData) {
  const schema = z.object({
    organizationId: uuid,
    code: z.string().trim().min(1, "Ingresa un código.").max(20).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2, "Ingresa el nombre del local."),
    address: optionalText,
    ubigeo: optionalText,
  });

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address"),
    ubigeo: formData.get("ubigeo"),
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    organization_id: parsed.data.organizationId,
    code: parsed.data.code,
    name: parsed.data.name,
    address: parsed.data.address,
    ubigeo: parsed.data.ubigeo,
    active: true,
  });

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Local creado correctamente.");
}

export async function updateBranchAction(formData: FormData) {
  const schema = z.object({
    organizationId: uuid,
    branchId: uuid,
    code: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2, "Ingresa el nombre del local."),
    address: optionalText,
    ubigeo: optionalText,
    active: z.boolean(),
  });

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    branchId: formData.get("branchId"),
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address"),
    ubigeo: formData.get("ubigeo"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .update({
      code: parsed.data.code,
      name: parsed.data.name,
      address: parsed.data.address,
      ubigeo: parsed.data.ubigeo,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.branchId)
    .eq("organization_id", parsed.data.organizationId);

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Local actualizado.");
}

export async function createSequenceAction(formData: FormData) {
  const schema = z.object({
    organizationId: uuid,
    branchId: uuid,
    documentType: z.enum(["01", "03"]),
    series: z.string().trim().regex(/^[A-Za-z0-9]{4}$/, "La serie debe tener 4 caracteres.").transform((value) => value.toUpperCase()),
  });

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    branchId: formData.get("branchId"),
    documentType: formData.get("documentType"),
    series: formData.get("series"),
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_document_sequence", {
    p_organization_id: parsed.data.organizationId,
    p_branch_id: parsed.data.branchId,
    p_document_type: parsed.data.documentType,
    p_series: parsed.data.series,
  });

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Serie creada correctamente.");
}

export async function toggleSequenceAction(formData: FormData) {
  const schema = z.object({
    organizationId: uuid,
    sequenceId: uuid,
    active: z.enum(["true", "false"]),
  });

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    sequenceId: formData.get("sequenceId"),
    active: formData.get("active"),
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_sequence_active", {
    p_organization_id: parsed.data.organizationId,
    p_sequence_id: parsed.data.sequenceId,
    p_active: parsed.data.active === "true",
  });

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Estado de la serie actualizado.");
}

export async function addMemberAction(formData: FormData) {
  const schema = z.object({
    organizationId: uuid,
    email: z.string().trim().email("Correo inválido."),
    role: z.enum(["owner", "cashier"]),
    branchId: z.union([uuid, z.literal("")]),
  });

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    role: formData.get("role"),
    branchId: formData.get("branchId") ?? "",
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_org_member_by_email", {
    p_organization_id: parsed.data.organizationId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_branch_id: parsed.data.branchId || null,
  });

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Usuario agregado a la organización.");
}

export async function updateMemberAction(formData: FormData) {
  const schema = z.object({
    organizationId: uuid,
    memberId: uuid,
    role: z.enum(["owner", "cashier"]),
    branchId: z.union([uuid, z.literal("")]),
    active: z.boolean(),
  });

  const parsed = schema.safeParse({
    organizationId: formData.get("organizationId"),
    memberId: formData.get("memberId"),
    role: formData.get("role"),
    branchId: formData.get("branchId") ?? "",
    active: formData.get("active") === "on",
  });

  if (!parsed.success) go("error", firstIssue(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_org_member_settings", {
    p_organization_id: parsed.data.organizationId,
    p_member_id: parsed.data.memberId,
    p_role: parsed.data.role,
    p_branch_id: parsed.data.branchId || null,
    p_active: parsed.data.active,
  });

  if (error) go("error", error.message);
  revalidatePath("/configuracion");
  go("success", "Permisos del usuario actualizados.");
}
