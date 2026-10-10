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
      title="Cobrar venta"
      description={`Total a cobrar: ${formatMoney(total)}`}
      icon={CreditCard}
      size="md"
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_METHODS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setMethod(item.value);
                if (item.value !== "cash") setReceived("");
              }}
              className={`flex h-12 items-center gap-3 rounded-xl border px-4 text-left text-sm font-semibold ${
                method === item.value
                  ? "border-orange-400 bg-orange-50 text-orange-800"
                  : "border-neutral-200"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <>
            <label className="block text-sm font-medium">
              Monto recibido
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">S/</span>
                <input
                  value={received}
                  onChange={(event) => setReceived(event.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-12 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-xl font-semibold tabular-nums outline-none focus:border-orange-400"
                />
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              {[total, 20, 50, 100, 200]
                .filter((value, index, values) => value >= total && values.indexOf(value) === index)
                .slice(0, 5)
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setReceived(String(value))}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-semibold"
                  >
                    {value === total ? "Exacto" : formatMoney(value)}
                  </button>
                ))}
            </div>

            <div className={`rounded-xl p-4 ${missing > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{missing > 0 ? "Falta" : "Vuelto"}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatMoney(missing > 0 ? missing : change)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
            Se registrará el total de {formatMoney(total)} con {PAYMENT_METHODS.find((item) => item.value === method)?.label}.
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => void onConfirm(method, method === "cash" ? receivedNumber : null)}
            className="h-11 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Procesando..." : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
