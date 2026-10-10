"use client";

import { useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { CalendarDays, LoaderCircle, ReceiptText, WalletCards } from "lucide-react";

import type { Branch } from "@/features/settings/types";
import { useFeedback } from "@/components/feedback";
import { getBusinessDateISO } from "@/lib/date-time";
import { expenseFormSchema, type ExpenseFormInput } from "../schemas/expense-schema";
import { EXPENSE_CATEGORIES } from "../types/expense";
import type { ExpenseActionResult } from "../server/actions";

const inputClass =
  "mt-1.5 block h-11 w-full rounded-[13px] border border-[#e8e3d7] bg-white px-3.5 text-sm text-[#14201b] outline-none transition placeholder:text-[#9b9f99] focus:border-orange-500 focus:ring-4 focus:ring-neutral-900/5 disabled:cursor-not-allowed disabled:bg-[#f6f3ec] disabled:text-[#7b8680] aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40";
const textareaClass =
  "mt-1.5 block min-h-24 w-full resize-y rounded-[13px] border border-[#e8e3d7] bg-white px-3.5 py-2.5 text-sm text-[#14201b] outline-none transition placeholder:text-[#9b9f99] focus:border-orange-500 focus:ring-4 focus:ring-neutral-900/5 disabled:bg-[#f6f3ec]";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#1e2d27]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[#7b8680]">{hint}</p>
      ) : null}
    </div>
  );
}

export function ExpenseForm({
  branches,
  timeZone,
  onCreate,
  onSuccess,
  onCancel,
  isSaving = false,
}: {
  branches: Branch[];
  timeZone: string;
  onCreate: (formData: FormData) => Promise<ExpenseActionResult>;
  onSuccess: (message: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
}) {
  const { toast } = useFeedback();
  const [isPending, startTransition] = useTransition();
  const defaultBranch = branches.find((branch) => branch.active)?.id ?? "";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    reset,
  } = useForm<ExpenseFormInput>({
    defaultValues: {
      expenseDate: getBusinessDateISO(new Date(), timeZone),
      branchId: defaultBranch,
      category: "compras",
      description: "",
      amount: "",
      notes: "",
    },
  });

  const busy = isPending || isSaving;
  const fieldError = (name: keyof ExpenseFormInput) => errors[name]?.message;

  const submit = (values: ExpenseFormInput) => {
    const parsed = expenseFormSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        setError(issue.path[0] as keyof ExpenseFormInput, { message: issue.message });
      });
      return;
    }

    const formData = new FormData();
    formData.set("expenseDate", parsed.data.expenseDate);
    formData.set("branchId", parsed.data.branchId);
    formData.set("category", parsed.data.category);
    formData.set("description", parsed.data.description);
    formData.set("amount", parsed.data.amount);
    formData.set("notes", parsed.data.notes ?? "");

    startTransition(async () => {
      const result = await onCreate(formData);
      if (!result.success) {
        toast.error(result.message);
        return;
      }

      reset({
        expenseDate: getBusinessDateISO(new Date(), timeZone),
        branchId: defaultBranch,
        category: "compras",
        description: "",
        amount: "",
        notes: "",
      });
      onSuccess(result.message);
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-7" noValidate>
      <section className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-[13px] bg-[#fff0e2] text-orange-600">
            <CalendarDays className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#14201b]">Fecha y local</h3>
            <p className="mt-0.5 text-xs text-[#7b8680]">
              La fecha corresponde al día del gasto, no al momento en que se registra.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="expenseDate" label="Fecha del egreso" error={fieldError("expenseDate")}>
            <input
              id="expenseDate"
              type="date"
              data-autofocus=""
              className={inputClass}
              disabled={busy}
              aria-invalid={Boolean(fieldError("expenseDate"))}
              {...register("expenseDate")}
            />
          </Field>

          <Field id="branchId" label="Local" error={fieldError("branchId")}>
            <select
              id="branchId"
              className={inputClass}
              disabled={busy}
              aria-invalid={Boolean(fieldError("branchId"))}
              {...register("branchId")}
            >
              {branches
                .filter((branch) => branch.active)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code} · {branch.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </section>

      <div className="h-px bg-[#e9e4d6]" />

      <section className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex size-8 items-center justify-center rounded-[13px] bg-[#e9e4d6] text-[#59665f]">
            <ReceiptText className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#14201b]">Detalle</h3>
            <p className="mt-0.5 text-xs text-[#7b8680]">
              Describe la salida de dinero de forma breve y trazable.
            </p>
          </div>
        </div>

        <Field id="category" label="Categoría" error={fieldError("category")}>
          <select
            id="category"
            className={inputClass}
            disabled={busy}
            aria-invalid={Boolean(fieldError("category"))}
            {...register("category")}
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="description" label="Descripción" error={fieldError("description")}>
          <input
            id="description"
            className={inputClass}
            placeholder="Ej. Compra de gas para cocina"
            disabled={busy}
            aria-invalid={Boolean(fieldError("description"))}
            {...register("description")}
          />
        </Field>

        <Field id="amount" label="Monto" error={fieldError("amount")}>
          <div className="relative mt-1.5">
            <span
              className="pointer-events-none absolute inset-y-px left-px flex w-10 items-center justify-center rounded-l-[7px] border-r border-[#e8e3d7] bg-[#f6f3ec] text-sm font-medium text-[#7b8680]"
              aria-hidden="true"
            >
              S/
            </span>
            <input
              id="amount"
              inputMode="decimal"
              className={`${inputClass} mt-0 pl-[3.25rem] tabular-nums`}
              placeholder="0.00"
              disabled={busy}
              aria-invalid={Boolean(fieldError("amount"))}
              {...register("amount")}
            />
          </div>
        </Field>

        <Field id="notes" label="Notas" error={fieldError("notes")} hint="Opcional. Máximo 500 caracteres.">
          <textarea
            id="notes"
            rows={3}
            className={textareaClass}
            disabled={busy}
            {...register("notes")}
          />
        </Field>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-[#eee9df] pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-11 rounded-[13px] border border-[#e8e3d7] bg-white px-5 text-sm font-medium text-[#35423c] transition hover:bg-[#f6f3ec] disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy || branches.every((branch) => !branch.active)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[13px] bg-[#14201b] px-5 text-sm font-medium text-white transition hover:bg-[#1e2d27] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <WalletCards className="size-4" aria-hidden="true" />}
          {busy ? "Registrando..." : "Registrar egreso"}
        </button>
      </div>
    </form>
  );
}
