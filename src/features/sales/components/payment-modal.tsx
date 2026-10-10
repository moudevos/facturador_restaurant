"use client";

import { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";

import { Modal } from "@/components/modal";
import { PAYMENT_METHODS, type PaymentMethod } from "../types/sales";
import { formatMoney } from "../utils/format";

export function PaymentModal({
  open,
  total,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  total: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod, receivedAmount: number | null) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");

  const receivedNumber = Number(received || 0);
  const change = useMemo(
    () => (method === "cash" ? Math.max(0, receivedNumber - total) : 0),
    [method, receivedNumber, total],
  );
  const missing = method === "cash" ? Math.max(0, total - receivedNumber) : 0;
  const valid = method !== "cash" || receivedNumber >= total;

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Método de pago"
      description={`Total a cobrar: ${formatMoney(total)}`}
      icon={CreditCard}
      size="md"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setMethod(item.value);
                if (item.value !== "cash") setReceived("");
              }}
              className={`flex min-h-[82px] flex-col items-center justify-center gap-1.5 rounded-[16px] border-[1.5px] px-2 text-center text-[11px] font-extrabold transition ${
                method === item.value
                  ? "border-orange-500 bg-[#fff0e2] text-[#e86400] shadow-[0_0_0_3px_rgba(255,122,26,.12)]"
                  : "border-[#e8e3d7] bg-white text-[#14201b]"
              }`}
            >
              <span className="text-[25px] leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <div className="rounded-[18px] border-[1.5px] border-[#e8e3d7] bg-white p-4">
            <label className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
              Monto recibido
              <div className="mt-2 flex items-center gap-2 border-b-2 border-[#14201b] pb-1.5">
                <span className="erp-mono text-lg font-bold text-[#7b8680]">S/</span>
                <input
                  value={received}
                  onChange={(event) => setReceived(event.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="erp-mono min-w-0 flex-1 bg-transparent text-[28px] font-bold tracking-[-0.03em] outline-none"
                />
              </div>
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {[total, 20, 50, 100, 200]
                .filter((value, index, values) => value >= total && values.indexOf(value) === index)
                .slice(0, 5)
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReceived(String(value))}
                    className="erp-mono rounded-[11px] bg-[#f6f3ec] px-3 py-2 text-xs font-bold"
                  >
                    {value === total ? "Exacto" : formatMoney(value)}
                  </button>
                ))}
            </div>

            <div
              className={`mt-3 flex items-center justify-between rounded-[14px] px-3.5 py-3 ${
                missing > 0 ? "bg-[#fde8e8] text-[#d64545]" : "bg-[#dff5e9] text-[#1f9d63]"
              }`}
            >
              <span className="text-sm font-extrabold">{missing > 0 ? "Falta" : "Vuelto"}</span>
              <span className="erp-mono text-lg font-bold">
                {formatMoney(missing > 0 ? missing : change)}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-[15px] bg-[#eee9dc] p-3 text-center text-sm text-[#7b8680]">
            Se registrará {formatMoney(total)} con{" "}
            <strong className="text-[#14201b]">
              {PAYMENT_METHODS.find((item) => item.value === method)?.label}
            </strong>.
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-[#e8e3d7] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-12 rounded-[15px] border border-[#e8e3d7] bg-white px-5 text-sm font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => void onConfirm(method, method === "cash" ? receivedNumber : null)}
            className="h-12 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] disabled:bg-[#d8d4c8] disabled:text-[#a5a396] disabled:shadow-none"
          >
            {pending ? "Procesando..." : "Confirmar pago"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
