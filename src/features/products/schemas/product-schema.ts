import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres.")
  .optional()
  .transform((value) => value || null);

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(120, "Máximo 120 caracteres."),
  categoryId: z.string().uuid("Selecciona una categoría válida."),
  sku: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres.")
    .optional()
    .transform((value) => value?.toUpperCase() || null),
  sunatProductCode: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^\d{8}$/.test(value),
      "El código SUNAT/UNSPSC debe tener exactamente 8 dígitos.",
    )
    .transform((value) => value || null),
  description: optionalText,
  price: z
    .string()
    .trim()
    .regex(
      /^\d+(?:\.\d{1,2})?$/,
      "Ingresa un precio válido con hasta 2 decimales.",
    )
    .refine((value) => Number(value) >= 0, "El precio no puede ser negativo."),
  unitCode: z.literal("NIU"),
  taxAffectationCode: z.enum(
    ["10", "20", "30"],
    "Selecciona una afectación válida.",
  ),
  active: z.boolean(),
});

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;
