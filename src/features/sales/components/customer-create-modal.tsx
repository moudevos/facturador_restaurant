"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Modal } from "@/components/modal";
import { useFeedback } from "@/components/feedback";
import { createCustomerAction } from "../server/actions";
import type { Customer } from "../types/sales";

export function CustomerCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}) {
  const { toast } = useFeedback();
  const [type, setType] = useState<"1" | "6">("1");
  const [documentNumber, setDocumentNumber] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);

  const expectedDigits = type === "1" ? 8 : 11;
  const valid = name.trim().length >= 2 && documentNumber.length === expectedDigits;

  async function submit() {
    if (!valid || pending) return;
    setPending(true);
    try {
      const result = await createCustomerAction({
        documentType: type,
        documentNumber,
        name,
        phone,
        email,
        address,
      });

      if (!result.success || !result.data) {
        toast.error(result.message);
        return;
      }

      const customer: Customer = {
        id: result.data.customerId,
        document_type: type,
        document_number: documentNumber,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        active: true,
      };

      onCreated(customer);
      toast.success(result.message);
      setDocumentNumber("");
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setType("1");
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Nuevo cliente"
      description="Se usará en boletas y facturas."
      icon={UserPlus}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => {
              setType("1");
              setDocumentNumber("");
            }}
            className={`h-10 rounded-lg text-sm font-semibold ${type === "1" ? "bg-white shadow-sm" : "text-neutral-500"}`}
          >
            Persona · DNI
          </button>
          <button
            type="button"
            onClick={() => {
              setType("6");
              setDocumentNumber("");
            }}
            className={`h-10 rounded-lg text-sm font-semibold ${type === "6" ? "bg-white shadow-sm" : "text-neutral-500"}`}
          >
            Empresa · RUC
          </button>
        </div>

        <label className="block text-sm font-medium">
          {type === "1" ? "Nombre completo" : "Razón social"}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-400"
          />
        </label>

        <label className="block text-sm font-medium">
          {type === "1" ? "DNI" : "RUC"}
          <input
            value={documentNumber}
            onChange={(event) =>
              setDocumentNumber(
                event.target.value.replace(/\D/g, "").slice(0, expectedDigits),
              )
            }
            inputMode="numeric"
            placeholder={`${expectedDigits} dígitos`}
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-400"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Teléfono
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none"
              placeholder="Opcional"
            />
          </label>
          <label className="block text-sm font-medium">
            Correo
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none"
              placeholder="Opcional"
            />
          </label>
        </div>

        <label className="block text-sm font-medium">
          Dirección
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none"
            placeholder="Opcional"
          />
        </label>

        <p className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
          Las facturas requieren seleccionar un cliente con RUC.
        </p>

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || pending}
            className="h-11 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Guardando..." : "Guardar cliente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
