import type { ProductFormInput } from "../schemas/product-schema";
import type { Product } from "../types/product";

export function productFormDefaults(
  product?: Product,
  defaultCategoryId = "",
): ProductFormInput {
  return {
    name: product?.name ?? "",
    categoryId: product?.category_id ?? defaultCategoryId,
    sku: product?.sku ?? "",
    sunatProductCode: product?.sunat_product_code ?? "",
    description: product?.description ?? "",
    price: product?.price == null ? "" : String(product.price),
    unitCode: "NIU",
    taxAffectationCode: product?.tax_affectation_code ?? "10",
    active: product?.active ?? true,
  };
}
