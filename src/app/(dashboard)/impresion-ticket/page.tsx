import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Printer, ReceiptText } from "lucide-react";
import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

async function saveReceiptPreference(formData: FormData) {
  "use server";
  const context = await getSalesContext();
  if (!context || context.role !== "owner") redirect("/impresion-ticket?estado=permiso");
  const selected = Number(formData.get("width"));
  if (selected !== 58 && selected !== 80) redirect("/impresion-ticket?estado=datos");
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_preferences")
    .update({ receipt_width_mm: selected, updated_at: new Date().toISOString() })
    .eq("organization_id", context.organizationId);
  if (error) redirect("/impresion-ticket?estado=error");
  revalidatePath("/pos-rapido");
  revalidatePath("/impresion-ticket");
  redirect("/impresion-ticket?estado=guardado");
}

export default async function ImpresionTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");
  const { estado } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("restaurant_preferences")
    .select("receipt_width_mm")
    .eq("organization_id", context.organizationId)
    .maybeSingle();
  const width = data?.receipt_width_mm === 58 ? 58 : 80;

  return <section className="mx-auto max-w-3xl space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Configuración</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-[#14201b] sm:text-3xl">
        <Printer className="size-6 text-orange-600" aria-hidden="true" /> Impresión de tickets
      </h1>
      <p className="mt-2 text-sm text-[#63746a]">
        Define el ancho del comprobante interno impreso desde el POS.
        No es un documento fiscal y no reemplaza la boleta o factura.
      </p>
    </header>
    {estado === "guardado" ? <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Ancho de ticket actualizado.</p> : null}
    {estado && estado !== "guardado" ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">No se pudo guardar el cambio.</p> : null}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se pudo cargar el ajuste. Comprueba SQL 018.</p> : null}
    <form action={saveReceiptPreference} className="rounded-2xl border border-[#e8e3d7] bg-white p-5 shadow-sm">
      <fieldset className="space-y-3">
        <legend className="text-base font-extrabold text-[#14201b]">Tamaño del papel</legend>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[#dad9d0] p-4 text-sm font-bold">
          <input name="width" type="radio" value="58" defaultChecked={width === 58}
            className="size-5 accent-orange-600" disabled={context.role !== "owner"} />
          <ReceiptText className="size-5 text-orange-600" aria-hidden="true" />
          Ticket térmico de 58 mm
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[#dad9d0] p-4 text-sm font-bold">
          <input name="width" type="radio" value="80" defaultChecked={width === 80}
            className="size-5 accent-orange-600" disabled={context.role !== "owner"} />
          <ReceiptText className="size-5 text-orange-600" aria-hidden="true" />
          Ticket térmico de 80 mm
        </label>
      </fieldset>
      {context.role === "owner" ? <button type="submit" className="mt-5 min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white">Guardar configuración</button> : null}
      <p className="mt-4 text-xs leading-relaxed text-[#63746a]">
        El ancho real depende también de la configuración y los márgenes de tu impresora en el navegador.
      </p>
    </form>
  </section>;
}
