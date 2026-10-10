"use client";

import { useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  Barcode,
  ChevronDown,
  Hash,
  LoaderCircle,
  Receipt,
  Shapes,
  Tag,
  type LucideIcon,
} from "lucide-react";

import { useFeedback } from "@/components/feedback";
import { productFormSchema, type ProductFormInput } from "../schemas/product-schema";
import type {
  Product,
  ProductCategory,
  ProductFormValues,
} from "../types/product";
import { productFormDefaults } from "../utils/product-form-defaults";
import {
  createProductAction,
  updateProductAction,
  type ProductActionResult,
} from "../server/actions";

const baseInput =
  "block w-full rounded-[13px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-sm text-[#14201b] outline-none transition placeholder:text-[#9b9f99] focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-[#f6f3ec] disabled:text-[#7b8680] aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40 aria-[invalid=true]:focus:ring-red-500/10";
const inputClass = `${baseInput} h-12`;
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
      <label htmlFor={id} className="text-sm font-bold text-[#1e2d27]">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[#7b8680]">{hint}</p>
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
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[13px] bg-[#fff0e2] text-orange-600">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-[#14201b]">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[#7b8680]">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function ProductForm({
  product,
  categories,
  onCreate,
  onUpdate,
  onSuccess,
  onCancel,
  isSaving = false,
}: {
  product?: Product;
  categories: ProductCategory[];
  onCreate?: (formData: FormData) => Promise<ProductActionResult>;
  onUpdate?: (formData: FormData) => Promise<ProductActionResult>;
  onSuccess?: (message: string) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}) {
  const { toast } = useFeedback();
  const [isPending, startTransition] = useTransition();
  const defaultCategoryId =
    product?.category_id ??
    categories.find((category) => category.code === "OTROS")?.id ??
    categories[0]?.id ??
    "";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
    reset,
  } = useForm<ProductFormInput>({
    defaultValues: productFormDefaults(product, defaultCategoryId),
  });

  const onSubmit = (values: ProductFormInput) => {
    const parsed = productFormSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof ProductFormInput, {
          message: issue.message,
        }),
      );
      return;
    }

    const formData = new FormData();
    Object.entries(parsed.data satisfies ProductFormValues).forEach(([key, value]) =>
      formData.set(key, String(value ?? "")),
    );

    startTransition(async () => {
      const result = product
        ? await (onUpdate ?? ((data: FormData) => updateProductAction(product.id, data)))(
            formData,
          )
        : await (onCreate ?? createProductAction)(formData);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      reset(productFormDefaults(product, defaultCategoryId));

      if (onSuccess) onSuccess(result.message);
      else toast.success(result.message);
    });
  };

  const fieldError = (name: keyof ProductFormInput) => errors[name]?.message;
  const busy = isPending || isSaving;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <Section
        icon={Tag}
        title="Identificación"
        description="Código interno, categoría y nombre que verá el equipo en el POS."
      >
        {product ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[15px] border border-[#e8e3d7] bg-[#f6f3ec] p-3.5">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
                <Hash className="size-3.5" />
                Código interno
              </div>
              <p className="erp-mono mt-2 text-lg font-bold text-[#14201b]">
                {product.product_code}
              </p>
              <p className="mt-1 text-[10px] text-[#7b8680]">
                Estable e inmutable. Se envía como codProducto.
              </p>
            </div>
            <div className="rounded-[15px] border border-[#e8e3d7] bg-white p-3.5">
              <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
                <Barcode className="size-3.5" />
                SKU comercial
              </div>
              <p className="erp-mono mt-2 text-sm font-bold text-[#14201b]">
                {product.sku || "Sin SKU"}
              </p>
              <p className="mt-1 text-[10px] text-[#7b8680]">
                Puede representar tu código de cocina o carta.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[15px] border border-dashed border-[#d8d2c0] bg-[#fbfaf6] p-3.5 text-xs leading-relaxed text-[#59665f]">
            El código interno se generará automáticamente al guardar, por ejemplo{" "}
            <span className="erp-mono font-extrabold text-[#14201b]">P000001</span>.
            No usamos el UUID de Supabase en el comprobante.
          </div>
        )}

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

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="categoryId"
            label="Categoría"
            required
            error={fieldError("categoryId")}
            hint="Se usa para ordenar y filtrar el catálogo y el POS."
          >
            <SelectWrap>
              <select
                id="categoryId"
                className={selectClass}
                aria-invalid={Boolean(fieldError("categoryId"))}
                disabled={busy}
                {...register("categoryId")}
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </SelectWrap>
          </Field>

          <Field
            id="sku"
            label="SKU comercial"
            error={fieldError("sku")}
            hint="Opcional. Ej.: BRO-P01, HAMB-CLA, BEB-COCA500."
          >
            <input
              id="sku"
              className={`${inputClass} erp-mono uppercase`}
              aria-invalid={Boolean(fieldError("sku"))}
              placeholder="HAMB-CLA"
              disabled={busy}
              {...register("sku")}
            />
          </Field>
        </div>

        <Field
          id="description"
          label="Descripción"
          error={fieldError("description")}
          hint="Opcional. Útil para diferenciar tamaños, ingredientes o presentaciones."
        >
          <textarea
            id="description"
            className={textareaClass}
            aria-invalid={Boolean(fieldError("description"))}
            placeholder="Carne, queso, papas y salsas."
            disabled={busy}
            {...register("description")}
          />
        </Field>
      </Section>

      <div className="h-px bg-[#eee9df]" />

      <Section
        icon={Receipt}
        title="Venta y tributación"
        description="Precio final, afectación IGV y código SUNAT del producto."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="price" label="Precio de venta" required error={fieldError("price")}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#7b8680]">
                S/
              </span>
              <input
                id="price"
                className={`${inputClass} erp-mono pl-9`}
                inputMode="decimal"
                aria-invalid={Boolean(fieldError("price"))}
                placeholder="0.00"
                disabled={busy}
                {...register("price")}
              />
            </div>
          </Field>

          <Field
            id="taxAffectationCode"
            label="Afectación IGV"
            required
            error={fieldError("taxAffectationCode")}
          >
            <SelectWrap>
              <select
                id="taxAffectationCode"
                className={selectClass}
                aria-invalid={Boolean(fieldError("taxAffectationCode"))}
                disabled={busy}
                {...register("taxAffectationCode")}
              >
                <option value="10">10 · Gravado</option>
                <option value="20">20 · Exonerado</option>
                <option value="30">30 · Inafecto</option>
              </select>
            </SelectWrap>
          </Field>
        </div>

        <input type="hidden" value="NIU" {...register("unitCode")} />

        <Field
          id="sunatProductCode"
          label="Código SUNAT / UNSPSC"
          error={fieldError("sunatProductCode")}
          hint="Opcional por ahora. Debe tener 8 dígitos y es distinto del código interno/SKU."
        >
          <div className="relative">
            <Shapes className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b9f99]" />
            <input
              id="sunatProductCode"
              className={`${inputClass} erp-mono pl-10`}
              inputMode="numeric"
              maxLength={8}
              aria-invalid={Boolean(fieldError("sunatProductCode"))}
              placeholder="Ej. 50192701"
              disabled={busy}
              {...register("sunatProductCode")}
            />
          </div>
        </Field>
      </Section>

      {product ? (
        <label className="flex items-center gap-3 rounded-[15px] border border-[#e8e3d7] bg-white p-3.5 text-sm font-bold text-[#35423c]">
          <input
            type="checkbox"
            className="size-4 accent-orange-500"
            disabled={busy}
            {...register("active")}
          />
          Producto activo y visible en el POS
        </label>
      ) : (
        <input type="hidden" value="true" {...register("active")} />
      )}

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-[#e8e3d7] bg-[#f6f3ec]/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-12 rounded-[15px] border border-[#e8e3d7] bg-white px-5 text-sm font-bold text-[#14201b] disabled:opacity-50"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy || categories.length === 0}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {busy ? "Guardando..." : product ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
