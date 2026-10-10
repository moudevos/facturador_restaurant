"use client";

import { WalletCards } from "lucide-react";

import { Modal } from "@/components/modal";
import type { Branch } from "@/features/settings/types";
import type { ExpenseActionResult } from "../server/actions";
import { ExpenseForm } from "./expense-form";

export function ExpenseCreateModal({
  open,
  isSaving,
  branches,
  timeZone,
  onClose,
  onCreate,
  onCreated,
}: {
  open: boolean;
  isSaving: boolean;
  branches: Branch[];
  timeZone: string;
  onClose: () => void;
  onCreate: (formData: FormData) => Promise<ExpenseActionResult>;
  onCreated: (message: string) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!isSaving}
      size="lg"
      icon={WalletCards}
      title="Registrar egreso"
      description="Registra una salida de dinero. Si luego detectas un error, se anula y se crea un nuevo registro."
    >
      <ExpenseForm
        branches={branches}
        timeZone={timeZone}
        onCreate={onCreate}
        onSuccess={onCreated}
        onCancel={onClose}
        isSaving={isSaving}
      />
    </Modal>
  );
}
