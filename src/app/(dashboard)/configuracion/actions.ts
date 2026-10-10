"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { SettingsActionResult } from "@/features/settings/types";
import { parseTab } from "./tab-ids";

const uuid = z.string().uuid("Identificador inválido.");
const ruc = z.string().regex(/^\d{11}$/, "El RUC debe contener 11 dígitos.");
const optionalText = z.string().trim().optional().transform((value) => value || null);

type Go = (kind: "success" | "error", message: string) => never;
type OwnerContext =
  | { ok: true; organizationId: string }
  | { ok: false; message: string };

function goFor(formData: FormData): Go {
  const tab = parseTab(formData.get("tab"));
  return (kind, message) =>
    redirect(`/configuracion?tab=${tab}&${kind}=${encodeURIComponent(message)}`);
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

function friendlyDatabaseError(message: string, fallback: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("último propietario") || normalized.includes("ultimo propietario")) {
    return "No se puede desactivar o degradar al último propietario activo.";
  }
  if (normalized.includes("no existe en supabase auth")) {
    return "El usuario no existe en Supabase Auth. Créalo primero desde Auth.";
  }
  if (normalized.includes("local inválido") || normalized.includes("local invalido")) {
    return "El local seleccionado no es válido o está inactivo.";
  }
  if (normalized.includes("duplicate") || normalized.includes("unique")) {
    return fallback;
  }

  return fallback;
}

async function requireOwner(): Promise<OwnerContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  if (error || !data?.[0]) return { ok: false, message: "No tienes una organización activa." };
  if (data[0].role !== "owner") {
    return { ok: false, message: "Solo un propietario puede modificar esta configuración." };
  }

  return { ok: true, organizationId: data[0].organization_id };
}

export async function initializeOrganizationAction(formData: FormData) {
  const go: Go = (kind, message) =>
    redirect(`/configuracion?${kind}=${encodeURIComponent(message)}`);

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

  if (error) go("error", "No pudimos crear la configuración inicial.");
  revalidatePath("/configuracion");
  go("success", "Empresa, local principal y serie B001 creados correctamente.");
}

export async function updateOrganizationAction(formData: FormData) {
  const go = goFor(formData);
  const owner = await requireOwner();
  if (!owner.ok) go("error", owner.message);

  const schema = z.object({
    legalName: z.string().trim().min(2, "Ingresa la razón social."),
    tradeName: optionalText,
    ruc,
    timezone: z.string().trim().min(1, "Selecciona una zona horaria."),
  });

  const parsed = schema.safeParse({
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
    .eq("id", owner.organizationId);

  if (error) go("error", "No pudimos actualizar los datos de la empresa.");
  revalidatePath("/configuracion");
  go("success", "Datos de la empresa actualizados.");
}

export async function createBranchAction(formData: FormData): Promise<SettingsActionResult> {
  const owner = await requireOwner();
  if (!owner.ok) return { success: false, message: owner.message };

  const schema = z.object({
    code: z.string().trim().min(1, "Ingresa un código.").max(20).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2, "Ingresa el nombre del local."),
    address: optionalText,
    ubigeo: optionalText,
  });

  const parsed = schema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address"),
    ubigeo: formData.get("ubigeo"),
  });

  if (!parsed.success) return { success: false, message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    organization_id: owner.organizationId,
    code: parsed.data.code,
    name: parsed.data.name,
    address: parsed.data.address,
    ubigeo: parsed.data.ubigeo,
    active: true,
  });

  if (error) {
    return {
      success: false,
      message: friendlyDatabaseError(error.message, "Ya existe un local con ese código o no pudimos guardarlo."),
    };
  }

  return { success: true, message: "Local creado correctamente." };
}

export async function updateBranchAction(formData: FormData): Promise<SettingsActionResult> {
  const owner = await requireOwner();
  if (!owner.ok) return { success: false, message: owner.message };

  const schema = z.object({
    branchId: uuid,
    code: z.string().trim().min(1, "Ingresa un código.").max(20).transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2, "Ingresa el nombre del local."),
    address: optionalText,
    ubigeo: optionalText,
    active: z.enum(["true", "false"]),
  });

  const parsed = schema.safeParse({
    branchId: formData.get("branchId"),
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address"),
    ubigeo: formData.get("ubigeo"),
    active: formData.get("active") === "true" ? "true" : "false",
  });

  if (!parsed.success) return { success: false, message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .update({
      code: parsed.data.code,
      name: parsed.data.name,
      address: parsed.data.address,
      ubigeo: parsed.data.ubigeo,
      active: parsed.data.active === "true",
    })
    .eq("id", parsed.data.branchId)
    .eq("organization_id", owner.organizationId);

  if (error) {
    return {
      success: false,
      message: friendlyDatabaseError(error.message, "No pudimos actualizar el local."),
    };
  }

  return { success: true, message: "Local actualizado correctamente." };
}

export async function createSequenceAction(formData: FormData): Promise<SettingsActionResult> {
  const owner = await requireOwner();
  if (!owner.ok) return { success: false, message: owner.message };

  const schema = z.object({
    branchId: uuid,
    documentType: z.enum(["01", "03"]),
    series: z.string().trim().regex(/^[A-Za-z0-9]{4}$/, "La serie debe tener 4 caracteres.").transform((value) => value.toUpperCase()),
  });

  const parsed = schema.safeParse({
    branchId: formData.get("branchId"),
    documentType: formData.get("documentType"),
    series: formData.get("series"),
  });

  if (!parsed.success) return { success: false, message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_document_sequence", {
    p_organization_id: owner.organizationId,
    p_branch_id: parsed.data.branchId,
    p_document_type: parsed.data.documentType,
    p_series: parsed.data.series,
  });

  if (error) {
    return {
      success: false,
      message: friendlyDatabaseError(
        error.message,
        "Ya existe esa serie para el local y tipo de documento, o no pudimos crearla.",
      ),
    };
  }

  return { success: true, message: "Serie creada correctamente." };
}

export async function toggleSequenceAction(
  sequenceId: string,
  active: boolean,
): Promise<SettingsActionResult> {
  const owner = await requireOwner();
  if (!owner.ok) return { success: false, message: owner.message };

  const parsedId = uuid.safeParse(sequenceId);
  if (!parsedId.success) return { success: false, message: "Serie inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_document_sequence_active", {
    p_organization_id: owner.organizationId,
    p_sequence_id: parsedId.data,
    p_active: active,
  });

  if (error) return { success: false, message: "No pudimos actualizar el estado de la serie." };
  return { success: true, message: active ? "Serie activada." : "Serie desactivada." };
}

export async function addMemberAction(formData: FormData): Promise<SettingsActionResult> {
  const owner = await requireOwner();
  if (!owner.ok) return { success: false, message: owner.message };

  const schema = z.object({
    email: z.string().trim().email("Correo inválido."),
    role: z.enum(["owner", "cashier"]),
    branchId: z.union([uuid, z.literal("")]),
  });

  const parsed = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    branchId: formData.get("branchId") ?? "",
  });

  if (!parsed.success) return { success: false, message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_org_member_by_email", {
    p_organization_id: owner.organizationId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_branch_id: parsed.data.branchId || null,
  });

  if (error) {
    return {
      success: false,
      message: friendlyDatabaseError(error.message, "No pudimos agregar el usuario."),
    };
  }

  return { success: true, message: "Usuario agregado a la organización." };
}

export async function updateMemberAction(formData: FormData): Promise<SettingsActionResult> {
  const owner = await requireOwner();
  if (!owner.ok) return { success: false, message: owner.message };

  const schema = z.object({
    memberId: uuid,
    role: z.enum(["owner", "cashier"]),
    branchId: z.union([uuid, z.literal("")]),
    active: z.enum(["true", "false"]),
  });

  const parsed = schema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
    branchId: formData.get("branchId") ?? "",
    active: formData.get("active") === "true" ? "true" : "false",
  });

  if (!parsed.success) return { success: false, message: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_org_member_settings", {
    p_organization_id: owner.organizationId,
    p_member_id: parsed.data.memberId,
    p_role: parsed.data.role,
    p_branch_id: parsed.data.branchId || null,
    p_active: parsed.data.active === "true",
  });

  if (error) {
    return {
      success: false,
      message: friendlyDatabaseError(error.message, "No pudimos actualizar los permisos del usuario."),
    };
  }

  return { success: true, message: "Permisos del usuario actualizados." };
}
