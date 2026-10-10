"use client";

import { useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { LoaderCircle } from "lucide-react";

import { useFeedback } from "@/components/feedback";
import { productFormSchema, type ProductFormInput } from "../schemas/product-schema";
import type { Product, ProductFormValues } from "../types/product";
import { productFormDefaults } from "../utils/product-form-defaults";
import {
  createProductAction,
  updateProductAction,
  type ProductActionResult,
} from "../server/actions";

const baseInput =
  "mt-1.5 block w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/10";
const inputClass = `${baseInput} h-11`;
const textareaClass = `${baseInput} min-h-24 resize-y py-2.5`;

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-700">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-400">{children}</h2>
  );
}

export function ProductForm({
  product,
  onCreate,
  onUpdate,
  onSuccess,
  onCancel,
  isSaving = false,
}: {
  product?: Product;
  onCreate?: (formData: FormData) => Promise<ProductActionResult>;
  onUpdate?: (formData: FormData) => Promise<ProductActionResult>;
  onSuccess?: (message: string) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}) {
  const { toast } = useFeedback();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    reset,
  } = useForm<ProductFormInput>({ defaultValues: productFormDefaults(product) });

  const onSubmit = (values: ProductFormInput) => {
    const parsed = productFormSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof ProductFormInput, { message: issue.message }),
      );
      return;
    }

    const formData = new FormData();
    Object.entries(parsed.data satisfies ProductFormValues).forEach(([key, value]) =>
      formData.set(key, String(value ?? "")),
    );

    startTransition(async () => {
      const result = product
        ? await (onUpdate ?? ((data: FormData) => updateProductAction(product.id, data)))(formData)
        : await (onCreate ?? createProductAction)(formData);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      reset(productFormDefaults(product));

      if (onSuccess) {
        onSuccess(result.message);
      } else {
        toast.success(result.message);
      }
    });
  };

  const fieldError = (name: keyof ProductFormInput) => errors[name]?.message;
  const busy = isPending || isSaving;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <div className="space-y-5">
        <SectionTitle>Información general</SectionTitle>

        <Field id="name" label="Nombre" required error={fieldError("name")}>
          <input
            id="name"
            className={inputClass}
            aria-invalid={Boolean(fieldError("name"))}
            placeholder="Hamburguesa clásica"
            disabled={busy}
            {...register("name")}
          />
        </Field>

        <Field
          id="sku"
          label="SKU"
          error={fieldError("sku")}
          hint="Código interno opcional para identificar el producto."
        >
          <input
            id="sku"
            className={inputClass}
            aria-invalid={Boolean(fieldError("sku"))}
            placeholder="HAM001"
            disabled={busy}
            {...register("sku")}
          />
        </Field>

        <Field id="description" label="Descripción" error={fieldError("description")}>
          <textarea
            id="description"
            className={textareaClass}
            rows={3}
            aria-invalid={Boolean(fieldError("description"))}
            disabled={busy}
            {...register("description")}
          />
        </Field>
      </div>

      <div className="h-px bg-neutral-100" />

      <div className="space-y-5">
        <SectionTitle>Precio y tributación</SectionTitle>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="price" label="Precio de venta" required error={fieldError("price")}>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-neutral-400"
                aria-hidden="true"
              >
                S/
              </span>
              <input
                id="price"
                inputMode="decimal"
                className={`${inputClass} pl-9 tabular-nums`}
                aria-invalid={Boolean(fieldError("price"))}
                placeholder="15.00"
                disabled={busy}
                {...register("price")}
              />
            </div>
          </Field>

          <Field id="unitCode" label="Unidad SUNAT" required>
            <select id="unitCode" className={inputClass} disabled={busy} {...register("unitCode")}>
              <option value="NIU">NIU - Unidad</option>
            </select>
          </Field>
        </div>

        <Field id="taxAffectationCode" label="Afectación IGV" required>
          <select
            id="taxAffectationCode"
            className={inputClass}
            disabled={busy}
            {...register("taxAffectationCode")}
          >
            <option value="10">10 - Gravado</option>
            <option value="20">20 - Exonerado</option>
            <option value="30">30 - Inafecto</option>
          </select>
        </Field>
      </div>

      {product ? (
        <>
          <div className="h-px bg-neutral-100" />
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-4 transition-colors hover:bg-neutral-50/60">
            <input
              type="checkbox"
              value="true"
              className="mt-0.5 size-4 rounded border-neutral-300 accent-neutral-900"
              disabled={busy}
              {...register("active")}
            />
            <span>
              <span className="block text-sm font-medium text-neutral-900">Producto activo</span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                Los productos inactivos no están disponibles para nuevas ventas.
              </span>
            </span>
          </label>
        </>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-6 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neutral-900/10 disabled:opacity-60"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neutral-900/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? "Guardando..." : product ? "Guardar cambios" : "Guardar producto"}
        </button>
      </div>
    </form>
  );
}
