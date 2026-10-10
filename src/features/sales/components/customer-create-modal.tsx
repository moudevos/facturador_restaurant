"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  LoaderCircle,
  Search,
  UserPlus,
  UserRound,
} from "lucide-react";

import { Modal } from "@/components/modal";
import { useFeedback } from "@/components/feedback";
import {
  createCustomerAction,
  lookupCustomerDocumentAction,
} from "../server/actions";
import type { Customer } from "../types/sales";

type VerifiedDocument = {
  documentType: "1" | "6";
  documentNumber: string;
  name: string;
  address: string | null;
  taxpayerStatus: string | null;
  taxpayerCondition: string | null;
};

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
  const [documentNumber, setDocumentNumber] = useState("");
  const [verified, setVerified] = useState<VerifiedDocument | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dniAddress, setDniAddress] = useState("");
  const [lookupPending, setLookupPending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const inferredType = useMemo(() => {
    if (documentNumber.length === 8) return "1" as const;
    if (documentNumber.length === 11) return "6" as const;
    return null;
  }, [documentNumber]);

  const pending = lookupPending || savePending;

  function reset() {
    setDocumentNumber("");
    setVerified(null);
    setPhone("");
    setEmail("");
    setDniAddress("");
    setLookupPending(false);
    setSavePending(false);
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  async function lookup() {
    if (!inferredType || lookupPending) return;

    setLookupPending(true);
    try {
      const result = await lookupCustomerDocumentAction({ documentNumber });

      if (!result.success || !result.data) {
        toast.error(result.message);
        return;
      }

      setVerified(result.data);
      setDocumentNumber(result.data.documentNumber);
      toast.success(result.message);
    } finally {
      setLookupPending(false);
    }
  }

  async function submit() {
    if (!verified || savePending) return;

    setSavePending(true);
    try {
      const address =
        verified.documentType === "6"
          ? verified.address ?? ""
          : dniAddress.trim();

      const result = await createCustomerAction({
        documentType: verified.documentType,
        documentNumber: verified.documentNumber,
        name: verified.name,
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
        document_type: verified.documentType,
        document_number: verified.documentNumber,
        name: verified.name,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address || null,
        active: true,
      };

      onCreated(customer);
      toast.success(result.message);
      reset();
      onClose();
    } finally {
      setSavePending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      dismissible={!pending}
      title={verified ? "Confirmar cliente" : "Nuevo cliente"}
      description={
        verified
          ? "Revisa los datos oficiales y completa la información de contacto."
          : "Primero consulta el DNI o RUC para evitar datos fiscales incorrectos."
      }
      icon={verified ? BadgeCheck : UserPlus}
      size="md"
    >
      {!verified ? (
        <div className="space-y-5">
          <div className="rounded-[18px] border border-[#e8e3d7] bg-white p-4">
            <label className="block">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
                DNI o RUC
              </span>
              <div className="relative mt-2">
                <input
                  value={documentNumber}
                  onChange={(event) =>
                    setDocumentNumber(
                      event.target.value.replace(/\D/g, "").slice(0, 11),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && inferredType) {
                      event.preventDefault();
                      void lookup();
                    }
                  }}
                  inputMode="numeric"
                  autoFocus
                  placeholder="8 dígitos DNI · 11 dígitos RUC"
                  className="erp-mono h-[54px] w-full rounded-[15px] border-[1.5px] border-[#e8e3d7] bg-white px-4 pr-12 text-[20px] font-bold tracking-[0.04em] outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                />
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                  {inferredType === "1" ? (
                    <UserRound className="size-5 text-orange-500" />
                  ) : inferredType === "6" ? (
                    <Building2 className="size-5 text-blue-600" />
                  ) : (
                    <Search className="size-5 text-[#9b9f99]" />
                  )}
                </div>
              </div>
            </label>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs leading-relaxed text-[#7b8680]">
                {inferredType === "1"
                  ? "Se consultará como DNI."
                  : inferredType === "6"
                    ? "Se consultará como RUC."
                    : "Ingresa exactamente 8 u 11 dígitos."}
              </p>
              {inferredType ? (
                <span className="shrink-0 rounded-full bg-[#fff0e2] px-2.5 py-1 text-[10px] font-extrabold text-orange-700">
                  {inferredType === "1" ? "DNI" : "RUC"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[15px] bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
            La consulta se realiza desde el servidor con ApiPeru. El token no se expone al navegador.
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#eee9df] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="h-12 rounded-[15px] border border-[#e8e3d7] bg-white px-5 text-sm font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void lookup()}
              disabled={!inferredType || lookupPending}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] disabled:opacity-50"
            >
              {lookupPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {lookupPending
                ? "Consultando..."
                : inferredType === "6"
                  ? "Consultar RUC"
                  : "Consultar DNI"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <BadgeCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">
                  Verificado con ApiPeru
                </p>
                <p className="mt-1 text-[15px] font-extrabold leading-snug text-[#14201b]">
                  {verified.name}
                </p>
                <p className="erp-mono mt-1 text-xs font-bold text-[#59665f]">
                  {verified.documentType === "6" ? "RUC" : "DNI"} · {verified.documentNumber}
                </p>
              </div>
            </div>

            {verified.documentType === "6" ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-200 pt-3">
                {verified.taxpayerStatus ? (
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#35423c]">
                    Estado: {verified.taxpayerStatus}
                  </span>
                ) : null}
                {verified.taxpayerCondition ? (
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold text-[#35423c]">
                    Condición: {verified.taxpayerCondition}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {verified.documentType === "6" && verified.address ? (
            <div className="rounded-[15px] border border-[#e8e3d7] bg-white p-3.5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
                Dirección SUNAT
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-relaxed text-[#35423c]">
                {verified.address}
              </p>
            </div>
          ) : null}

          {verified.documentType === "1" ? (
            <label className="block text-sm font-bold text-[#35423c]">
              Dirección
              <input
                value={dniAddress}
                onChange={(event) => setDniAddress(event.target.value)}
                className="mt-1.5 h-12 w-full rounded-[15px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                placeholder="Opcional · ApiPeru DNI no devuelve dirección"
              />
            </label>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-[#35423c]">
              Teléfono
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1.5 h-12 w-full rounded-[15px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-sm outline-none focus:border-orange-500"
                placeholder="Opcional"
              />
            </label>

            <label className="block text-sm font-bold text-[#35423c]">
              Correo
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="mt-1.5 h-12 w-full rounded-[15px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-sm outline-none focus:border-orange-500"
                placeholder="Opcional"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              setVerified(null);
              setPhone("");
              setEmail("");
              setDniAddress("");
            }}
            disabled={pending}
            className="text-left text-xs font-extrabold text-orange-600 underline decoration-orange-300 underline-offset-4"
          >
            Cambiar documento
          </button>

          <div className="flex flex-col-reverse gap-2 border-t border-[#eee9df] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="h-12 rounded-[15px] border border-[#e8e3d7] bg-white px-5 text-sm font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={savePending}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] disabled:opacity-50"
            >
              {savePending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <BadgeCheck className="size-4" />
              )}
              {savePending ? "Guardando..." : "Guardar cliente verificado"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
