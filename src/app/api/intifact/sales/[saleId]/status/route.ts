import { NextResponse } from "next/server";

import { getSalesContext } from "@/features/sales/server/context";
import { syncSaleIntifactStatus } from "@/features/sales/server/intifact-status";

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

  try {
    const status = await syncSaleIntifactStatus(context, saleId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar el estado fiscal.",
      },
      { status: 502 },
    );
  }
}
