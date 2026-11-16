import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ArrowDownLeft, Plus } from "lucide-react";

import { getSalesContext, listAccessibleBranches } from "@/features/sales/server/context";
import { formatMoney } from "@/features/sales/utils/format";
import { getBusinessDateISO } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/server";

async function registerOtherIncome(formData: FormData) {
  "use server";
  const context = await getSalesContext();
  if (!context || context.role !== "owner") redirect("/ingresos?estado=permiso");

  const description = String(formData.get("description") ?? "").trim();
  const amountText = String(formData.get("amount") ?? "");
  const branchId = String(formData.get("branch_id") ?? "");
  const incomeDate = String(formData.get("income_date") ?? "");
  const methodId = String(formData.get("payment_method_id") ?? "");
  const note = String(formData.get("notes") ?? "").trim();

  const branches = await listAccessibleBranches(context);
  const today = getBusinessDateISO(new Date(), context.timeZone);
  if (
    description.length < 3 || description.length > 160 ||
    !/^\d+(\.\d{1,2})?$/.test(amountText) ||
    Number(amountText) <= 0 || Number(amountText) > 999999999.99 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(incomeDate) || incomeDate > today ||
    !branches.some((branch) => branch.id === branchId) ||
    note.length > 500
  ) {
    redirect("/ingresos?estado=datos");
  }

  const supabase = await createClient();
  if (methodId) {
    const { data: method } = await supabase
      .from("restaurant_payment_methods")
      .select("id")
      .eq("id", methodId)
      .eq("organization_id", context.organizationId)
      .eq("active", true)
      .maybeSingle();
    if (!method) redirect("/ingresos?estado=datos");
  }

  const { error } = await supabase.from("restaurant_other_income").insert({
    organization_id: context.organizationId,
    branch_id: branchId,
    income_date: incomeDate,
    description,
    amount: Number(amountText),
    payment_method_id: methodId || null,
    notes: note || null,
    created_by: context.userId,
  });
  if (error) redirect("/ingresos?estado=error");

  revalidatePath("/ingresos");
  revalidatePath("/resultado");
  redirect("/ingresos?estado=guardado");
}

type IncomeRow = {
  id: string;
  income_date: string;
  description: string;
  amount: number | string;
  notes: string | null;
};

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");
  const { estado } = await searchParams;
  const supabase = await createClient();
  const today = getBusinessDateISO(new Date(), context.timeZone);
  const branches = await listAccessibleBranches(context);
  const [methodsResult, incomesResult] = await Promise.all([
    supabase.from("restaurant_payment_methods")
      .select("id,name,kind")
      .eq("organization_id", context.organizationId)
      .eq("active", true)
      .order("sort_order"),
    supabase.from("restaurant_other_income")
      .select("id,income_date,description,amount,notes")
      .eq("organization_id", context.organizationId)
      .order("income_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const rows = (incomesResult.data ?? []) as IncomeRow[];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Finanzas</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#14201b] sm:text-3xl">
            Ingresos
          </h1>
          <p className="mt-2 text-sm text-[#63746a]">
            Las ventas del POS se contabilizan automáticamente. Aquí registras únicamente otros ingresos.
          </p>
        </div>
        <Link href="/resultado" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dad9d0] bg-white px-4 text-sm font-bold text-[#14201b]">
          <ArrowDownLeft className="size-4" aria-hidden="true" /> Ver resultado
        </Link>
      </header>

      {estado === "guardado" ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Ingreso registrado correctamente.</p> : null}
      {estado && estado !== "guardado" ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">No se guardó el ingreso. Revisa los datos, permisos y SQL 017.</p> : null}
      {incomesResult.error || methodsResult.error ? (
        <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Faltan tablas o permisos. Aplica SQL 017 en Supabase.</p>
      ) : null}

      {context.role === "owner" && branches.length > 0 ? (
        <form action={registerOtherIncome} className="rounded-2xl border border-[#e8e3d7] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="size-5 text-orange-600" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#14201b]">Registrar otro ingreso</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c] md:col-span-2">
              Descripción
              <input required name="description" minLength={3} maxLength={160} placeholder="Ej. Ingreso adicional del restaurante"
                className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c]">
              Importe (S/)
              <input required name="amount" type="number" inputMode="decimal" step="0.01" min="0.01" max="999999999.99"
                className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c]">
              Fecha de ingreso
              <input required name="income_date" type="date" defaultValue={today} max={today}
                className="min-h-11 rounded-xl border border-[#dad9d0] px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c]">
              Local
              <select name="branch_id" required defaultValue={branches[0].id}
                className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c]">
              Medio de pago (opcional)
              <select name="payment_method_id" defaultValue=""
                className="min-h-11 rounded-xl border border-[#dad9d0] bg-white px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
                <option value="">No especificado</option>
                {(methodsResult.data ?? []).map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[#35423c] md:col-span-2">
              Nota (opcional)
              <textarea name="notes" maxLength={500} rows={2}
                className="rounded-xl border border-[#dad9d0] p-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" />
            </label>
          </div>
          <button type="submit" className="mt-5 min-h-11 rounded-xl bg-orange-600 px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600">
            Registrar ingreso
          </button>
        </form>
      ) : (
        <p className="rounded-xl border border-[#e8e3d7] bg-white p-4 text-sm text-[#63746a]">
          Solo el administrador puede registrar ingresos adicionales.
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e8e3d7] bg-white">
        <header className="border-b border-[#eee9df] p-5">
          <h2 className="font-extrabold text-[#14201b]">Últimos ingresos adicionales</h2>
          <p className="mt-1 text-xs text-[#63746a]">Las ventas se consultan en el POS e Historiales.</p>
        </header>
        <div className="divide-y divide-[#eee9df]">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold text-[#14201b]">{row.description}</p>
                <p className="mt-1 text-xs text-[#63746a]">{row.income_date}</p>
              </div>
              <strong className="erp-mono text-emerald-700">{formatMoney(Number(row.amount))}</strong>
            </div>
          ))}
          {!rows.length ? <p className="p-6 text-center text-sm text-[#63746a]">No hay ingresos adicionales registrados.</p> : null}
        </div>
      </section>
    </section>
  );
}
