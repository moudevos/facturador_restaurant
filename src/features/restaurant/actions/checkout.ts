"use server";

import { z } from "zod";

import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

const CheckoutSchema = z.object({
  sessionId: uuid,
  token: uuid,
  items: z.array(z.object({
    productId: uuid,
    quantity: z.number().positive().max(100),
    addonIds: z.array(uuid).max(20),
    discountRuleId: uuid.nullable(),
    notes: z.string().max(200),
  })).min(1).max(80),
  payments: z.array(z.object({
    methodId: uuid,
    amount: z.number().positive(),
    reference: z.string().max(120),
  })).min(1).max(12),
  saleDiscountRuleId: uuid.nullable(),
  customerId: uuid.nullable(),
});

export type CheckoutRequest = z.infer<typeof CheckoutSchema>;

export async function checkoutInternalSale(input: CheckoutRequest): Promise<
  { ok: true; orderId: string } | { ok: false; message: string }
> {
  const parsed = CheckoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa el carrito y los pagos." };

  const context = await getSalesContext();
  if (!context) return { ok: false, message: "Debes iniciar sesión." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restaurant_checkout", {
    p_session_id: parsed.data.sessionId,
    p_client_token: parsed.data.token,
    p_items: parsed.data.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      addons: item.addonIds.map((addonId) => ({ addon_id: addonId })),
      discount_rule_id: item.discountRuleId,
      notes: item.notes,
    })),
    p_payments: parsed.data.payments.map((payment) => ({
      method_id: payment.methodId,
      amount: payment.amount,
      reference: payment.reference,
    })),
    p_sale_discount_rule: parsed.data.saleDiscountRuleId,
    p_customer_id: parsed.data.customerId,
  });

  if (error || typeof data !== "string") {
    return { ok: false, message: error?.message || "No se pudo registrar la venta." };
  }

  return { ok: true, orderId: data };
}
