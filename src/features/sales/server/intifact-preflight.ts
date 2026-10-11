import { createHash } from "node:crypto";

import { listCompanies } from "@/lib/intifact/client";
import { createClient } from "@/lib/supabase/server";
import type { SalesContext } from "./context";

const ISSUER_CACHE_TTL_MS = 5 * 60 * 1000;
const verifiedIssuers = new Map<string, number>();


/**
 * Fail closed before the POS transaction allocates a fiscal number.
 * invoice/compute checks amounts, but does not validate the issuer RUC.
 */
export async function assertIntifactIssuerReady(context: SalesContext) {
  const supabase = await createClient();
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("ruc")
    .eq("id", context.organizationId)
    .maybeSingle();

  if (error || !organization || !/^\d{11}$/.test(organization.ruc ?? "")) {
    throw new Error("Configura un RUC emisor válido antes de registrar ventas.");
  }

  // A short positive-only cache avoids an extra Intifact request per sale.
  // Include the API key and URL fingerprints so test/live and rotated keys
  // cannot accidentally share an issuer validation.
  const configFingerprint = createHash("sha256")
    .update(process.env.INTIFACT_API_KEY ?? "")
    .update(process.env.INTIFACT_API_URL ?? "")
    .digest("hex");
  const cacheKey = `${context.organizationId}:${organization.ruc}:${configFingerprint}`;
  if ((verifiedIssuers.get(cacheKey) ?? 0) > Date.now()) return;

  // Do not cache an unverified issuer. A failed check must never reserve
  // a correlativo.
  let companies: Awaited<ReturnType<typeof listCompanies>>;
  try {
    companies = await listCompanies();
  } catch (cause) {
    throw new Error(
      "No se pudo verificar el RUC emisor en Intifact. No se asignó correlativo.",
      { cause },
    );
  }

  if (!companies.some((company) => company.ruc === organization.ruc)) {
    const environment = process.env.INTIFACT_API_KEY?.startsWith("fact_test_")
      ? "TEST"
      : "LIVE";

    throw new Error(
      `El RUC ${organization.ruc} no está vinculado a la API key de Intifact (${environment}). Regístralo o vincúlalo en Configuración antes de emitir.`,
    );
  }

  verifiedIssuers.set(cacheKey, Date.now() + ISSUER_CACHE_TTL_MS);
}
