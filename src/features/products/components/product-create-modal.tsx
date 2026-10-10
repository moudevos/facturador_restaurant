"use client";

import { PackagePlus } from "lucide-react";

import { Modal } from "@/components/modal";
import { ProductForm } from "./product-form";
import type { ProductActionResult } from "../server/actions";
import type { ProductCategory } from "../types/product";

export function ProductCreateModal({
  open,
  categories,
  isSaving,
  onClose,
  onCreate,
  onCreated,
}: {
  open: boolean;
  categories: ProductCategory[];
  isSaving: boolean;
  onClose: () => void;
  onCreate: (formData: FormData) => Promise<ProductActionResult>;
  onCreated: (message: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!isSaving}
      size="lg"
      icon={PackagePlus}
      title="Nuevo producto"
      description="Registra un producto con código interno estable, categoría y datos fiscales."
    >
      <ProductForm
        categories={categories}
        onCreate={onCreate}
        onSuccess={onCreated}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </Modal>
  );
}
