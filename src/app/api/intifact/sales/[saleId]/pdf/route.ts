import { NextResponse } from "next/server";

import { getSalesContext } from "@/features/sales/server/context";
import { getInvoicePdf } from "@/lib/intifact/client";
import type { IntifactPdfFormat } from "@/lib/intifact/types";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_FORMATS = new Set<IntifactPdfFormat>([
  "a4",
  "ticket",
  "ticket80",
  "ticket58",
]);

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ saleId: string }> },
) {
  const context = await getSalesContext();
  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { saleId } = await params;
  const url = new URL(request.url);
  const requested = (url.searchParams.get("format") || "a4") as IntifactPdfFormat;
  const format = ALLOWED_FORMATS.has(requested) ? requested : "a4";

  const supabase = await createClient();
  const { data: sale, error } = await supabase
    .from("sales")
    .select("id, organization_id, series, correlative, status, intifact_document_id")
    .eq("id", saleId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (error || !sale) {
    return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });
  }

  if (sale.status !== "accepted" || !sale.intifact_document_id) {
    return NextResponse.json(
      { error: "El PDF estará disponible cuando Intifact/SUNAT acepte el comprobante." },
      { status: 409 },
    );
  }

  try {
    const pdf = await getInvoicePdf(sale.intifact_document_id, format);
    const filename = `${sale.series}-${String(sale.correlative).padStart(8, "0")}-${format}.pdf`;

    return new Response(pdf.bytes, {
      status: 200,
      headers: {
        "Content-Type": pdf.contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (pdfError) {
    return NextResponse.json(
      {
        error:
          pdfError instanceof Error
            ? pdfError.message
            : "No se pudo descargar el PDF.",
      },
      { status: 502 },
    );
  }
}
