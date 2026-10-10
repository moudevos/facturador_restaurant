import { z } from "zod";

import { EXPENSE_CATEGORIES } from "../types/expense";

const categoryValues = EXPENSE_CATEGORIES.map((item) => item.value) as [
  (typeof EXPENSE_CATEGORIES)[number]["value"],
  ...(typeof EXPENSE_CATEGORIES)[number]["value"][],
];

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const optionalText = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres.")
  .optional()
  .transform((value) => value || null);

export const expenseFormSchema = z.object({
  expenseDate: z
    .string()
    .trim()
    .refine(isCalendarDate, "Selecciona una fecha válida."),
  branchId: z.string().uuid("Selecciona un local válido."),
  category: z.enum(categoryValues, "Selecciona una categoría válida."),
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria.")
    .max(160, "Máximo 160 caracteres."),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/, "Ingresa un monto válido con hasta 2 decimales.")
    .refine((value) => Number(value) > 0, "El monto debe ser mayor que cero.")
    .refine((value) => Number(value) <= 9_999_999_999.99, "El monto es demasiado alto."),
  notes: optionalText,
});

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;
export type ExpenseFormData = z.output<typeof expenseFormSchema>;
