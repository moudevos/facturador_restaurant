"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ApiPeruError,
  lookupIssuerRuc,
  type ApiPeruEstablishment,
} from "@/lib/apiperu/client";
import {
  listCompanies,
  listCompanyBranches,
  hasIntifactCompanyLogo,
} from "@/lib/intifact/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSalesContext } from "@/features/sales/server/context";
import type {
  ReceiptSettings,
  SettingsActionResult,
  SunatEstablishment,
} from "../types";

type FiscalVerificationResult = SettingsActionResult & {
  data?: {
    ruc: string;
    legalName: string;
    taxpayerStatus: string | null;
    taxpayerCondition: string | null;
    fiscalAddress: string | null;
    fiscalUbigeo: string | null;
    intifactCompanyId: string | null;
    intifactMatched: boolean;
    intifactMessage: string | null;
    establishments: SunatEstablishment[];
  };
};

async function requireOwner() {
  const context = await getSalesContext();
  if (!context || context.role !== "owner") return null;
  return context;
}

function mapEstablishments(
  establishments: ApiPeruEstablishment[],
  intifactCodes: Set<string>,
  localCodes: Set<string>,
): SunatEstablishment[] {
  return establishments.map((item) => ({
    code: item.codigo,
    type: item.tipo_de_establecimiento,
    activity: item.actividad_economica?.trim() || null,
    address: item.direccion_completa,
    department: item.departamento?.trim() || null,
    province: item.provincia?.trim() || null,
    district: item.distrito?.trim() || null,
    ubigeo: item.ubigeo_sunat?.trim() || null,
    intifactRegistered: intifactCodes.has(item.codigo),
    localImported: localCodes.has(item.codigo),
  }));
}

export async function verifyIssuerRucAction(
  ruc: string,
): Promise<FiscalVerificationResult> {
  const context = await requireOwner();
  if (!context) {
    return {
      success: false,
      message: "Solo el owner puede verificar el emisor.",
    };
  }

  const parsed = z.string().trim().regex(/^\d{11}$/).safeParse(ruc);
  if (!parsed.success) {
    return { success: false, message: "El RUC debe contener 11 dígitos." };
  }

  try {
    const profile = await lookupIssuerRuc(parsed.data);

    let intifactCompanyId: string | null = null;
    let intifactCodes = new Set<string>();
    let intifactMessage: string | null = null;

    try {
      const companies = await listCompanies();
      const company = companies.find((item) => item.ruc === profile.ruc) ?? null;

      if (company) {
        intifactCompanyId = company.id;
        const intifactBranches = await listCompanyBranches(company.id);
        intifactCodes = new Set(
          intifactBranches
            .filter((branch) => branch.active)
            .map((branch) => branch.codigo),
        );
      } else {
        intifactMessage =
          "El RUC está en SUNAT, pero no aparece entre las empresas emisoras de esta API key de Intifact.";
      }
    } catch (error) {
      intifactMessage =
        error instanceof Error
          ? "No se pudo validar Intifact: " + error.message
          : "No se pudo validar la empresa en Intifact.";
    }

    const supabase = await createClient();
    const { data: localBranches } = await supabase
      .from("branches")
      .select("sunat_establishment_code")
      .eq("organization_id", context.organizationId)
      .not("sunat_establishment_code", "is", null);

    const localCodes = new Set(
      (localBranches ?? [])
        .map((branch) => branch.sunat_establishment_code)
        .filter((value): value is string => typeof value === "string"),
    );

    const { error } = await supabase.rpc("apply_verified_fiscal_profile", {
      p_organization_id: context.organizationId,
      p_ruc: profile.ruc,
      p_legal_name: profile.legalName,
      p_sunat_status: profile.taxpayerStatus,
      p_sunat_condition: profile.taxpayerCondition,
      p_fiscal_address: profile.fiscalAddress,
      p_fiscal_ubigeo: profile.fiscalUbigeo,
      p_intifact_company_id: intifactCompanyId,
    });

    if (error) {
      return {
        success: false,
        message:
          error.message ||
          "No se pudo persistir la verificación fiscal. Verifica SQL 014.",
      };
    }

    revalidatePath("/configuracion");

    const intifactMatched = Boolean(intifactCompanyId);

    return {
      success: true,
      message: intifactMatched
        ? "RUC verificado con ApiPeru y vinculado con Intifact."
        : "RUC verificado con ApiPeru. Falta vincular el mismo RUC en Intifact.",
      data: {
        ruc: profile.ruc,
        legalName: profile.legalName,
        taxpayerStatus: profile.taxpayerStatus,
        taxpayerCondition: profile.taxpayerCondition,
        fiscalAddress: profile.fiscalAddress,
        fiscalUbigeo: profile.fiscalUbigeo,
        intifactCompanyId,
        intifactMatched,
        intifactMessage,
        establishments: mapEstablishments(
          profile.establishments,
          intifactCodes,
          localCodes,
        ),
      },
    };
  } catch (error) {
    if (error instanceof ApiPeruError) {
      if (error.code === "document_not_found") {
        return {
          success: false,
          message: "ApiPeru/SUNAT no encontró el RUC indicado.",
        };
      }

      if (error.retryable) {
        return {
          success: false,
          message:
            "ApiPeru no está disponible temporalmente. Intenta nuevamente.",
        };
      }
    }

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo verificar el RUC.",
    };
  }
}

export async function getVerifiedEstablishmentsAction(): Promise<{
  success: boolean;
  message: string;
  data?: SunatEstablishment[];
}> {
  const context = await requireOwner();
  if (!context) return { success: false, message: "No autorizado." };

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("ruc, fiscal_verified, intifact_company_id")
    .eq("id", context.organizationId)
    .maybeSingle();

  if (!organization?.fiscal_verified) {
    return {
      success: false,
      message: "Primero verifica el RUC del emisor.",
    };
  }

  try {
    const profile = await lookupIssuerRuc(organization.ruc);
    let intifactCodes = new Set<string>();

    if (organization.intifact_company_id) {
      try {
        const branches = await listCompanyBranches(
          organization.intifact_company_id,
        );
        intifactCodes = new Set(
          branches
            .filter((branch) => branch.active)
            .map((branch) => branch.codigo),
        );
      } catch {
        // Los locales SUNAT siguen siendo utilizables para la importación local.
      }
    }

    const { data: localBranches } = await supabase
      .from("branches")
      .select("sunat_establishment_code")
      .eq("organization_id", context.organizationId)
      .not("sunat_establishment_code", "is", null);

    return {
      success: true,
      message: "Establecimientos SUNAT actualizados.",
      data: mapEstablishments(
        profile.establishments,
        intifactCodes,
        new Set(
          (localBranches ?? [])
            .map((branch) => branch.sunat_establishment_code)
            .filter((value): value is string => typeof value === "string"),
        ),
      ),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron consultar los establecimientos.",
    };
  }
}

export async function importSunatEstablishmentsAction(
  codes: string[],
): Promise<SettingsActionResult> {
  const context = await requireOwner();
  if (!context) return { success: false, message: "No autorizado." };

  const parsed = z
    .array(z.string().regex(/^\d{4}$/))
    .min(1)
    .max(50)
    .safeParse(codes);

  if (!parsed.success) {
    return {
      success: false,
      message: "Selecciona establecimientos SUNAT válidos.",
    };
  }

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("ruc, fiscal_verified")
    .eq("id", context.organizationId)
    .maybeSingle();

  if (!organization?.fiscal_verified) {
    return { success: false, message: "Primero verifica el RUC." };
  }

  try {
    const profile = await lookupIssuerRuc(organization.ruc);
    const byCode = new Map(
      profile.establishments.map((item) => [item.codigo, item]),
    );

    for (const code of parsed.data) {
      const source = byCode.get(code);
      if (!source) continue;

      const { data: existing } = await supabase
        .from("branches")
        .select("id")
        .eq("organization_id", context.organizationId)
        .eq("sunat_establishment_code", code)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase
          .from("branches")
          .update({
            address: source.direccion_completa || null,
            ubigeo: source.ubigeo_sunat || null,
            active: true,
          })
          .eq("id", existing.id)
          .eq("organization_id", context.organizationId);

        if (updateError) throw updateError;
        continue;
      }

      if (code === "0000") {
        const { data: primary } = await supabase
          .from("branches")
          .select("id")
          .eq("organization_id", context.organizationId)
          .order("created_at")
          .limit(1)
          .maybeSingle();

        if (primary) {
          const { error: primaryError } = await supabase
            .from("branches")
            .update({
              sunat_establishment_code: "0000",
              address: source.direccion_completa || null,
              ubigeo: source.ubigeo_sunat || null,
              active: true,
            })
            .eq("id", primary.id)
            .eq("organization_id", context.organizationId);

          if (primaryError) throw primaryError;
          continue;
        }
      }

      const label =
        source.tipo_de_establecimiento?.trim() || "Establecimiento";

      const { error: insertError } = await supabase.from("branches").insert({
        organization_id: context.organizationId,
        code: "SUNAT-" + code,
        name: label + " " + code,
        address: source.direccion_completa || null,
        ubigeo: source.ubigeo_sunat || null,
        sunat_establishment_code: code,
        active: true,
      });

      if (insertError) throw insertError;
    }

    revalidatePath("/configuracion");
    return {
      success: true,
      message: "Establecimientos importados/actualizados en Locales.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron importar los locales.",
    };
  }
}

export async function saveReceiptSettingsAction(input: {
  tradeName: string;
  footerText: string;
  paperWidth: ReceiptSettings["paper_width"];
  printerMode: ReceiptSettings["printer_mode"];
  autoPrint: boolean;
  showProductCode: boolean;
  showPaymentMethod: boolean;
}): Promise<SettingsActionResult> {
  const context = await requireOwner();
  if (!context) return { success: false, message: "No autorizado." };

  const parsed = z
    .object({
      tradeName: z.string().trim().min(2).max(120),
      footerText: z.string().trim().max(240),
      paperWidth: z.enum(["48", "58", "80", "a4"]),
      printerMode: z.enum([
        "system",
        "bluetooth-ble",
        "android-bridge",
      ]),
      autoPrint: z.boolean(),
      showProductCode: z.boolean(),
      showPaymentMethod: z.boolean(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Revisa la configuración del comprobante.",
    };
  }

  const supabase = await createClient();

  const [organizationResult, settingsResult] = await Promise.all([
    supabase
      .from("organizations")
      .update({ trade_name: parsed.data.tradeName })
      .eq("id", context.organizationId),
    supabase.from("receipt_settings").upsert({
      organization_id: context.organizationId,
      footer_text: parsed.data.footerText || null,
      paper_width: parsed.data.paperWidth,
      printer_mode: parsed.data.printerMode,
      auto_print: parsed.data.autoPrint,
      show_product_code: parsed.data.showProductCode,
      show_payment_method: parsed.data.showPaymentMethod,
    }),
  ]);

  if (organizationResult.error || settingsResult.error) {
    return {
      success: false,
      message:
        "No se pudo guardar la configuración. Verifica que SQL 014 esté aplicado.",
    };
  }

  revalidatePath("/configuracion");
  return {
    success: true,
    message: "Configuración del comprobante guardada.",
  };
}

export async function uploadReceiptLogoAction(
  formData: FormData,
): Promise<SettingsActionResult & { logoUrl?: string }> {
  const context = await requireOwner();
  if (!context) return { success: false, message: "No autorizado." };

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return { success: false, message: "Selecciona una imagen." };
  }

  const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (
    !allowed.has(file.type) ||
    file.size <= 0 ||
    file.size > 2 * 1024 * 1024
  ) {
    return {
      success: false,
      message:
        "El logo debe ser PNG, JPG o WebP y pesar máximo 2 MB.",
    };
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = context.organizationId + "/receipt-logo." + extension;

  try {
    const admin = createAdminClient();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("organization-assets")
      .upload(path, bytes, {
        contentType: file.type,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      return { success: false, message: "No se pudo subir el logo." };
    }

    const { error: updateError } = await admin
      .from("receipt_settings")
      .upsert({
        organization_id: context.organizationId,
        logo_path: path,
      });

    if (updateError) {
      return {
        success: false,
        message: "El logo subió, pero no pudo vincularse.",
      };
    }

    const { data } = admin.storage
      .from("organization-assets")
      .getPublicUrl(path);

    revalidatePath("/configuracion");

    return {
      success: true,
      message: "Logo actualizado.",
      logoUrl: data.publicUrl + "?v=" + Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el logo.",
    };
  }
}

/**
 * Read-only readiness check. A configured logo does not certify that a PDF
 * lacks TEST watermark; only the Intifact environment and an actual LIVE PDF
 * can establish that.
 */
export async function inspectFiscalPdfBrandingAction(): Promise<
  SettingsActionResult & {
    data?: { environment: "TEST" | "LIVE" | "UNKNOWN"; localLogo: boolean; intifactLogo: boolean };
  }
> {
  const context = await requireOwner();
  if (!context) return { success: false, message: "Solo el owner puede revisar el logo fiscal." };

  const apiKey = process.env.INTIFACT_API_KEY ?? "";
  const environment = apiKey.startsWith("fact_test_")
    ? "TEST" as const
    : apiKey.startsWith("fact_live_")
      ? "LIVE" as const
      : "UNKNOWN" as const;

  const supabase = await createClient();
  const [orgResult, receiptResult] = await Promise.all([
    supabase.from("organizations")
      .select("intifact_company_id")
      .eq("id", context.organizationId)
      .maybeSingle(),
    supabase.from("receipt_settings")
      .select("logo_path")
      .eq("organization_id", context.organizationId)
      .maybeSingle(),
  ]);

  if (orgResult.error || receiptResult.error) {
    return { success: false, message: "No se pudo leer la configuración fiscal." };
  }

  const companyId = orgResult.data?.intifact_company_id;
  if (!companyId) {
    return {
      success: false,
      message: "Vincula primero el emisor con Intifact. El logo local no configura el PDF oficial.",
    };
  }

  try {
    const intifactLogo = await hasIntifactCompanyLogo(companyId);
    return {
      success: true,
      message: intifactLogo
        ? "Intifact tiene un logo accesible para el emisor."
        : "Falta subir el logo del emisor en el portal de Intifact.",
      data: {
        environment,
        localLogo: Boolean(receiptResult.data?.logo_path),
        intifactLogo,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "No se pudo comprobar el logo de Intifact.",
    };
  }
}
