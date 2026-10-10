import { NextResponse } from "next/server";

import { getSalesContext } from "@/features/sales/server/context";
import { getInvoiceCdr } from "@/lib/intifact/client";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const { data: sale, error } = await supabase
    .from("sales")
    .select("series, correlative, intifact_document_id")
    .eq("id", saleId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (error || !sale) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  if (!sale.intifact_document_id) {
    return NextResponse.json(
      { error: "El comprobante todavía no tiene documento en Intifact." },
      { status: 409 },
    );
  }

  try {
    const artifact = await getInvoiceCdr(sale.intifact_document_id);
    const extension = artifact.contentType.includes("xml") ? "xml" : "zip";
    const filename = `R-${sale.series}-${String(sale.correlative).padStart(8, "0")}.${extension}`;

    return new Response(artifact.bytes, {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": artifact.contentDisposition || `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (downloadError) {
    return NextResponse.json(
      {
        error:
          downloadError instanceof Error
            ? downloadError.message
            : "No se pudo descargar el CDR.",
      },
      { status: 502 },
    );
  }
}
