"use client";

import { Package } from "lucide-react";

import { Modal } from "@/components/modal";
import { ProductForm } from "./product-form";
import type { ProductActionResult } from "../server/actions";
import type { Product, ProductCategory } from "../types/product";

export function ProductEditModal({
  product,
  categories,
  open,
  isSaving,
  onClose,
  onUpdate,
}: {
  product: Product;
  categories: ProductCategory[];
  open: boolean;
  isSaving: boolean;
  onClose: () => void;
  onUpdate: (formData: FormData) => Promise<ProductActionResult>;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!isSaving}
      size="lg"
      icon={Package}
      title="Editar producto"
      description={`Actualiza «${product.name}». El código ${product.product_code} no cambia.`}
    >
      <ProductForm
        product={product}
        categories={categories}
        onUpdate={onUpdate}
        onSuccess={() => undefined}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </Modal>
  );
}
