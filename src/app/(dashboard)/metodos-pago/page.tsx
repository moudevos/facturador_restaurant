import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CreditCard, Plus, Settings2 } from "lucide-react";

import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

const kinds = [
  { value: "cash", label: "Efectivo físico" },
  { value: "wallet", label: "Billetera digital" },
  { value: "card", label: "Tarjeta" },
  { value: "bank", label: "Transferencia bancaria" },
  { value: "other", label: "Otro" },
] as const;

async function createPaymentMethod(formData: FormData) {
  "use server";
  const context = await getSalesContext();
  if (!context || context.role !== "owner") redirect("/metodos-pago?estado=permiso");

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const kind = String(formData.get("kind") ?? "");
  if (!name || name.length > 80 || !/^[a-z0-9_]{2,32}$/.test(code) ||
      !kinds.some((item) => item.value === kind)) {
    redirect("/metodos-pago?estado=datos");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_payment_methods").insert({
    organization_id: context.organizationId,
    code,
    name,
    kind,
  });
  if (error) redirect("/metodos-pago?estado=error");
  revalidatePath("/metodos-pago");
  revalidatePath("/ingresos");
  redirect("/metodos-pago?estado=guardado");
}

async function updatePaymentMethod(formData: FormData) {
  "use server";
  const context = await getSalesContext();
  if (!context || context.role !== "owner") redirect("/metodos-pago?estado=permiso");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const active = formData.get("active") === "on";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !name || name.length > 80 ||
      !kinds.some((item) => item.value === kind)) {
    redirect("/metodos-pago?estado=datos");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_payment_methods")
    .update({ name, kind, active })
    .eq("id", id)
    .eq("organization_id", context.organizationId);
  if (error) redirect("/metodos-pago?estado=error");
  revalidatePath("/metodos-pago");
  revalidatePath("/ingresos");
  redirect("/metodos-pago?estado=guardado");
}

export default async function MetodosPagoPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");
  const { estado } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("restaurant_payment_methods")
    .select("id,code,name,kind,active,sort_order")
    .eq("organization_id", context.organizationId)
    .order("sort_order")
    .order("name");

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Configuración</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#14201b] sm:text-3xl">Métodos de pago</h1>
        <p className="mt-2 text-sm text-[#63746a]">
          Personaliza los medios disponibles. Solo los de tipo efectivo afectan el arqueo físico.
          Desactivar un método no modifica cobros históricos.
        </p>
      </header>
      {estado === "guardado" ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Configuración guardada.</p> : null}
      {estado && estado !== "guardado" ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">No se guardó. Revisa los datos o el código duplicado.</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No se pudo consultar los métodos. Comprueba SQL 017.</p> : null}
      {context.role === "owner" ? (
        <form action={createPaymentMethod} className="rounded-2xl border border-[#e8e3d7] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="size-5 text-orange-600" aria-hidden="true" />
            <h2 className="font-extrabold text-[#14201b]">Nuevo método</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c]">
              Nombre
              <input name="name" required maxLength={80} placeholder="Ej. Yape principal"
                className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-orange-600" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c]">
              Código interno
              <input name="code" required minLength={2} maxLength={32} pattern="[a-z0-9_]{2,32}" placeholder="yape_principal"
                className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-orange-600" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c]">
              Tipo
              <select name="kind" defaultValue="wallet"
                className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 font-normal focus-visible:outline-2 focus-visible:outline-orange-600">
                {kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </select>
            </label>
          </div>
          <button type="submit" className="mt-4 min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-orange-600">
            Añadir método
          </button>
        </form>
      ) : null}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-extrabold text-[#14201b]">
          <Settings2 className="size-5 text-orange-600" aria-hidden="true" />
          Métodos configurados
        </h2>
        {(data ?? []).map((method) => (
          <form action={updatePaymentMethod} key={method.id}
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#e8e3d7] bg-white p-4 shadow-sm">
            <input type="hidden" name="id" value={method.id} />
            <CreditCard aria-hidden="true" className="mb-3 size-5 text-[#63746a]" />
            <label className="grid min-w-[160px] flex-1 gap-1.5 text-xs font-semibold text-[#35423c]">
              Nombre
              <input name="name" required maxLength={80} defaultValue={method.name} disabled={context.role !== "owner"}
                className="min-h-11 rounded-xl border border-[#dad9d0] px-3 text-sm font-normal disabled:bg-[#f8f6f1]" />
            </label>
            <label className="grid min-w-[190px] flex-1 gap-1.5 text-xs font-semibold text-[#35423c]">
              Tipo
              <select name="kind" defaultValue={method.kind} disabled={context.role !== "owner"}
                className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 text-sm font-normal">
                {kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#35423c]">
              <input name="active" type="checkbox" defaultChecked={method.active} disabled={context.role !== "owner"}
                className="size-4 accent-orange-600" />
              Activo
            </label>
            <span className="self-center text-xs text-[#63746a]">{method.code}</span>
            {context.role === "owner" ? <button type="submit" className="min-h-11 rounded-xl bg-[#14201b] px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-orange-600">Guardar</button> : null}
          </form>
        ))}
        {!data?.length ? <p className="rounded-xl bg-white p-5 text-sm text-[#63746a]">Sin métodos configurados.</p> : null}
      </section>
    </section>
  );
}
