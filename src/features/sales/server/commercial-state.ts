import { createAdminClient } from "@/lib/supabase/admin";

export async function finalizeAcceptedSale(saleId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "finalize_sale_after_fiscal_acceptance",
    { p_sale_id: saleId },
  );

  if (error) {
    throw new Error(
      "SUNAT aceptó el comprobante, pero no se pudo completar el estado comercial.",
    );
  }
}

export async function reverseFailedSale(
  saleId: string,
  reason: string,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "reverse_sale_after_fiscal_failure",
    {
      p_sale_id: saleId,
      p_reason: reason,
    },
  );

  if (error) {
    throw new Error(
      "El comprobante falló, pero no se pudo revertir su efecto comercial.",
    );
  }
}

export async function applyFiscalCommercialOutcome(
  saleId: string,
  fiscalStatus: string,
  reason?: string | null,
) {
  if (fiscalStatus === "accepted") {
    await finalizeAcceptedSale(saleId);
    return "completed" as const;
  }

  if (fiscalStatus === "rejected") {
    await reverseFailedSale(
      saleId,
      reason || "Comprobante rechazado por SUNAT.",
    );
    return "failed" as const;
  }

  return "pending" as const;
}
