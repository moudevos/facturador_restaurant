"use client";

import { AppModal } from "@/components/ui/app-modal";
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
    <AppModal
      open={open}
      onClose={onClose}
      isBusy={isSaving}
      title="Nuevo producto"
      description="Registra un producto para tus ventas y comprobantes."
    >
      <ProductForm
        onCreate={onCreate}
        onSuccess={onCreated}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </AppModal>
  );
}
