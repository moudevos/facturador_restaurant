import type { ProductFormInput } from "../schemas/product-schema";
import type { Product } from "../types/product";

export function productFormDefaults(product?: Product): ProductFormInput {
  return {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    price: product?.price == null ? "" : String(product.price),
    unitCode: "NIU",
    taxAffectationCode: product?.tax_affectation_code ?? "10",
    active: product?.active ?? true,
  };
}
