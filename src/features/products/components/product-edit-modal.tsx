"use client";

import { Modal } from "@/components/modal";
import { ProductForm } from "./product-form";
import type { ProductActionResult } from "../server/actions";
import type { Product } from "../types/product";

export function ProductEditModal({
  product,
  open,
  isSaving,
  onClose,
  onUpdate,
}: {
  product: Product;
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
      title="Editar producto"
      description="Actualiza los datos del catálogo comercial."
    >
      <ProductForm
        product={product}
        onUpdate={onUpdate}
        onSuccess={() => undefined}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </Modal>
  );
}
