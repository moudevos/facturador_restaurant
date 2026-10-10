"use client";

import { Modal } from "@/components/modal";
import { ProductForm } from "./product-form";
import type { ProductActionResult } from "../server/actions";

export function ProductCreateModal({
  open,
  isSaving,
  onClose,
  onCreate,
  onCreated,
}: {
  open: boolean;
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
      title="Nuevo producto"
      description="Registra un producto para tus ventas y comprobantes."
    >
      <ProductForm
        onCreate={onCreate}
        onSuccess={onCreated}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </Modal>
  );
}
