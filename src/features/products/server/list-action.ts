"use server";

import { getProductContext, listProducts } from "./products";
import type { ProductStatusFilter } from "../types/product";

export async function listProductsAction(
  query: string,
  status: ProductStatusFilter,
  categoryId: string,
  page: number,
) {
  const context = await getProductContext();
  if (!context) {
    return {
      products: [],
      count: 0,
      errorMessage: "No pudimos cargar los productos.",
    };
  }

  const result = await listProducts({
    organizationId: context.organizationId,
    query,
    status,
    categoryId,
    page,
  });

  return {
    products: result.products,
    count: result.count,
    errorMessage: result.error ? "No pudimos cargar los productos." : null,
  };
}
