import { describe, expect, it } from "vitest";

import { productFormSchema } from "./product-schema";
import { productFormDefaults } from "../utils/product-form-defaults";
import type { Product } from "../types/product";

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

const valid = {
  name: "Hamburguesa",
  categoryId: CATEGORY_ID,
  sku: "HAM001",
  sunatProductCode: "",
  description: "Clásica",
  price: "15.00",
  unitCode: "NIU",
  taxAffectationCode: "10",
  active: true,
};

describe("productFormSchema", () => {
  it("requiere y recorta el nombre", () => {
    expect(productFormSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(productFormSchema.parse({ ...valid, name: "  Hamburguesa  " }).name).toBe(
      "Hamburguesa",
    );
  });

  it("normaliza SKU a mayúsculas y textos vacíos a null", () => {
    const data = productFormSchema.parse({
      ...valid,
      sku: "  ham-001  ",
      description: " ",
    });
    expect(data.sku).toBe("HAM-001");
    expect(data.description).toBeNull();
  });

  it("acepta precio válido y rechaza negativo o más de dos decimales", () => {
    expect(productFormSchema.safeParse(valid).success).toBe(true);
    expect(productFormSchema.safeParse({ ...valid, price: "-1" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...valid, price: "1.999" }).success).toBe(false);
  });

  it("solo admite afectaciones permitidas", () => {
    expect(
      productFormSchema.safeParse({ ...valid, taxAffectationCode: "30" }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({ ...valid, taxAffectationCode: "40" }).success,
    ).toBe(false);
  });

  it("valida código UNSPSC de 8 dígitos", () => {
    expect(
      productFormSchema.safeParse({
        ...valid,
        sunatProductCode: "50192701",
      }).success,
    ).toBe(true);
    expect(
      productFormSchema.safeParse({
        ...valid,
        sunatProductCode: "123",
      }).success,
    ).toBe(false);
  });

  it("normaliza a string un precio numérico recibido desde Supabase al editar", () => {
    const product: Product = {
      id: "00000000-0000-4000-8000-000000000001",
      product_code: "P000001",
      sku: "HAM001",
      name: "Hamburguesa",
      description: null,
      category_id: CATEGORY_ID,
      category: {
        id: CATEGORY_ID,
        code: "HAMBURGUESAS",
        name: "Hamburguesas",
        active: true,
        sort_order: 30,
      },
      sunat_product_code: "50192701",
      unit_code: "NIU",
      price: 10,
      tax_affectation_code: "20",
      active: true,
      updated_at: "2026-10-10T00:00:00Z",
    };

    expect(productFormDefaults(product).price).toBe("10");
    expect(productFormDefaults(product).categoryId).toBe(CATEGORY_ID);
    expect(productFormSchema.safeParse(productFormDefaults(product)).success).toBe(true);
  });
});
