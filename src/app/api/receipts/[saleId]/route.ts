import { NextResponse } from "next/server";

import { getReceiptData } from "@/features/receipts/server/receipt-data";
import { getSalesContext } from "@/features/sales/server/context";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const context = await getSalesContext();
  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { saleId } = await params;
  const receipt = await getReceiptData(context, saleId);

  if (!receipt) {
    return NextResponse.json(
      { error: "El comprobante todavía no está aceptado/completado." },
      { status: 409 },
    );
  }

  return NextResponse.json(receipt, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
