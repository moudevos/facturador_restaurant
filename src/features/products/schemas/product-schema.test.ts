import { describe, expect, it } from "vitest";

import { productFormSchema } from "./product-schema";
import { productFormDefaults } from "../utils/product-form-defaults";
import type { Product } from "../types/product";

const valid = {
  name: "Hamburguesa",
  sku: "HAM001",
  description: "Clásica",
  price: "15.00",
  unitCode: "NIU",
  taxAffectationCode: "10",
  active: true,
};

describe("productFormSchema", () => {
  it("requiere y recorta el nombre", () => {
    expect(productFormSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(productFormSchema.parse({ ...valid, name: "  Hamburguesa  " }).name).toBe("Hamburguesa");
  });

  it("normaliza SKU y descripción vacíos a null", () => {
    const data = productFormSchema.parse({ ...valid, sku: "  ", description: " " });
    expect(data.sku).toBeNull();
    expect(data.description).toBeNull();
  });

  it("acepta precio válido y rechaza negativo o más de dos decimales", () => {
    expect(productFormSchema.safeParse(valid).success).toBe(true);
    expect(productFormSchema.safeParse({ ...valid, price: "-1" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...valid, price: "1.999" }).success).toBe(false);
  });

  it("solo admite afectaciones permitidas", () => {
    expect(productFormSchema.safeParse({ ...valid, taxAffectationCode: "30" }).success).toBe(true);
    expect(productFormSchema.safeParse({ ...valid, taxAffectationCode: "40" }).success).toBe(false);
  });

  it("normaliza a string un precio numérico recibido desde Supabase al editar", () => {
    const product: Product = {
      id: "00000000-0000-0000-0000-000000000001",
      sku: "HAM001",
      name: "Hamburguesa",
      description: null,
      unit_code: "NIU",
      price: 10,
      tax_affectation_code: "20",
      active: true,
      updated_at: "2026-10-10T00:00:00Z",
    };

    expect(productFormDefaults(product).price).toBe("10");
    expect(productFormSchema.safeParse(productFormDefaults(product)).success).toBe(true);
  });
});
