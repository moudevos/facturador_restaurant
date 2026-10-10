"use client";

import { useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { AlertCircle, ChevronDown, LoaderCircle, Receipt, Tag, type LucideIcon } from "lucide-react";

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
  "block w-full rounded-[13px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-sm text-[#14201b] outline-none transition placeholder:text-[#9b9f99] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-[#f6f3ec] disabled:text-[#7b8680] aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40 aria-[invalid=true]:focus:ring-red-500/10";
const inputClass = `${baseInput} h-11`;
const textareaClass = `${baseInput} min-h-24 resize-y py-2.5 leading-relaxed`;
const selectClass = `${inputClass} appearance-none pr-10`;

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
      <label htmlFor={id} className="text-sm font-medium text-[#1e2d27]">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[#7b8680]">{hint}</p>
      ) : null}
    </div>
  );
}

function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b9f99]"
        aria-hidden="true"
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <header className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[13px] bg-[#fff0e2] text-orange-600">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#14201b]">{title}</h2>
          <p className="mt-0.5 text-xs text-[#7b8680]">{description}</p>
        </div>
      </header>
      {children}
    </section>
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
      <Section
        icon={Tag}
        title="Información general"
        description="Cómo se identificará el producto en ventas y comprobantes."
      >
        <Field id="name" label="Nombre" required error={fieldError("name")}>
          <input
            id="name"
            data-autofocus=""
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
            className={`${inputClass} font-mono uppercase placeholder:font-sans placeholder:normal-case`}
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
            placeholder="Detalles que ayuden a distinguir este producto (opcional)"
            disabled={busy}
            {...register("description")}
          />
        </Field>
      </Section>

      <div className="h-px bg-[#e9e4d6]" />

      <Section
        icon={Receipt}
        title="Precio y tributación"
        description="Datos que se usarán al emitir boletas y facturas."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="price" label="Precio de venta" required error={fieldError("price")}>
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-px left-px flex w-10 items-center justify-center rounded-l-[7px] border-r border-[#e8e3d7] bg-[#f6f3ec] text-sm font-medium text-[#7b8680]"
                aria-hidden="true"
              >
                S/
              </span>
              <input
                id="price"
                inputMode="decimal"
                className={`${inputClass} pl-[3.25rem] tabular-nums`}
                aria-invalid={Boolean(fieldError("price"))}
                placeholder="15.00"
                disabled={busy}
                {...register("price")}
              />
            </div>
          </Field>

          <Field id="unitCode" label="Unidad SUNAT" required>
            <SelectWrap>
              <select id="unitCode" className={selectClass} disabled={busy} {...register("unitCode")}>
                <option value="NIU">NIU - Unidad</option>
              </select>
            </SelectWrap>
          </Field>
        </div>

        <Field
          id="taxAffectationCode"
          label="Afectación IGV"
          required
          hint="Define cómo se calcula el impuesto en el comprobante."
        >
          <SelectWrap>
            <select
              id="taxAffectationCode"
              className={selectClass}
              disabled={busy}
              {...register("taxAffectationCode")}
            >
              <option value="10">10 - Gravado</option>
              <option value="20">20 - Exonerado</option>
              <option value="30">30 - Inafecto</option>
            </select>
          </SelectWrap>
        </Field>
      </Section>

      {product ? (
        <>
          <div className="h-px bg-[#e9e4d6]" />
          <label
            className={`flex cursor-pointer items-center justify-between gap-4 rounded-[16px] border border-[#e8e3d7] bg-[#f6f3ec]/60 p-4 transition-colors hover:bg-[#f6f3ec] ${
              busy ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <span>
              <span className="block text-sm font-medium text-[#14201b]">Producto activo</span>
              <span className="mt-0.5 block text-xs text-[#7b8680]">
                Los productos inactivos no están disponibles para nuevas ventas.
              </span>
            </span>
            <span className="relative inline-flex shrink-0">
              <input
                type="checkbox"
                value="true"
                className="peer sr-only"
                disabled={busy}
                {...register("active")}
              />
              <span
                className="h-6 w-11 rounded-full bg-neutral-300 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-4 peer-focus-visible:ring-neutral-900/10"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
                aria-hidden="true"
              />
            </span>
          </label>
        </>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-[#e8e3d7] bg-[#f6f3ec]/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="hidden text-xs text-[#9b9f99] sm:block">
          <span className="text-red-500">*</span> Campo obligatorio
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex h-12 items-center justify-center rounded-[15px] border border-[#e8e3d7] bg-white px-5 text-sm font-bold text-[#14201b] transition hover:bg-[#fbfaf6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? "Guardando..." : product ? "Guardar cambios" : "Guardar producto"}
          </button>
        </div>
      </div>
    </form>
  );
}