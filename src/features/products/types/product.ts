export type ProductStatusFilter = "todos" | "activo" | "inactivo";
export const PRODUCTS_PER_PAGE = 20;

export type ProductCategory = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  product_code: string;
  sku: string | null;
  name: string;
  description: string | null;
  category_id: string;
  category: ProductCategory | null;
  sunat_product_code: string | null;
  unit_code: "NIU";
  price: string | number;
  tax_affectation_code: "10" | "20" | "30";
  active: boolean;
  updated_at: string;
};

export type ProductFormValues = {
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string;
  sunatProductCode: string | null;
  price: string;
  unitCode: "NIU";
  taxAffectationCode: "10" | "20" | "30";
  active: boolean;
};
