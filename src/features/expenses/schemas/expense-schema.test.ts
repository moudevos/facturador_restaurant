import { describe, expect, it } from "vitest";

import { expenseFormSchema } from "./expense-schema";

const valid = {
  expenseDate: "2026-10-10",
  branchId: "11111111-1111-4111-8111-111111111111",
  category: "compras",
  description: "Compra de gas",
  amount: "85.50",
  notes: "",
};

describe("expenseFormSchema", () => {
  it("valida un egreso correcto y normaliza notas vacías", () => {
    const parsed = expenseFormSchema.parse(valid);
    expect(parsed.notes).toBeNull();
    expect(parsed.description).toBe("Compra de gas");
  });

  it("rechaza fecha calendario inválida", () => {
    expect(expenseFormSchema.safeParse({ ...valid, expenseDate: "2026-02-30" }).success).toBe(false);
  });

  it("rechaza monto cero, negativo y más de dos decimales", () => {
    expect(expenseFormSchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...valid, amount: "-1" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...valid, amount: "10.999" }).success).toBe(false);
  });

  it("solo acepta categorías conocidas", () => {
    expect(expenseFormSchema.safeParse({ ...valid, category: "servicios" }).success).toBe(true);
    expect(expenseFormSchema.safeParse({ ...valid, category: "inventario" }).success).toBe(false);
  });
});
