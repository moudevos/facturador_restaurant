export type ProductStatusFilter = "todos" | "activo" | "inactivo";
export const PRODUCTS_PER_PAGE = 20;
export type Product = { id: string; sku: string | null; name: string; description: string | null; unit_code: "NIU"; price: string; tax_affectation_code: "10" | "20" | "30"; active: boolean; updated_at: string };
export type ProductFormValues = { name: string; sku: string | null; description: string | null; price: string; unitCode: "NIU"; taxAffectationCode: "10" | "20" | "30"; active: boolean };
