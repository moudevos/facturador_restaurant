"use client";

import { useMemo, useState } from "react";
import { Building2, Plus, Search, UserRound } from "lucide-react";

import { Modal } from "@/components/modal";
import type { Customer } from "../types/sales";

export function CustomerSelectorModal({
  open,
  customers,
  selectedId,
  onClose,
  onSelect,
  onCreate,
}: {
  open: boolean;
  customers: Customer[];
  selectedId: string | null;
  onClose: () => void;
  onSelect: (customer: Customer | null) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.document_number.includes(term),
    );
  }, [customers, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seleccionar cliente"
      description="Busca por nombre, DNI o RUC."
      icon={UserRound}
      size="md"
    >
      <div className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#7b8680]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, DNI o RUC"
            className="h-12 w-full rounded-[14px] border-[1.5px] border-[#e8e3d7] bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-400"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          className={`flex w-full items-center gap-3 rounded-[16px] border-[1.5px] p-3 text-left transition ${
            selectedId === null
              ? "border-orange-500 bg-[#fff0e2]"
              : "border-[#e8e3d7] bg-white"
          }`}
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#14201b] text-white">
            <UserRound className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold">Cliente varios</p>
            <p className="text-xs text-[#7b8680]">Boleta sin documento</p>
          </div>
          <span className="rounded-[7px] bg-[#f6f3ec] px-2 py-1 text-[10px] font-extrabold tracking-wide">
            BOLETA
          </span>
        </button>

        <div className="max-h-[46vh] space-y-2 overflow-y-auto">
          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => {
                onSelect(customer);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-[16px] border-[1.5px] p-3 text-left transition ${
                selectedId === customer.id
                  ? "border-orange-500 bg-[#fff0e2]"
                  : "border-[#e8e3d7] bg-white"
              }`}
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${
                  customer.document_type === "6" ? "bg-blue-600" : "bg-[#14201b]"
                }`}
              >
                {customer.document_type === "6" ? (
                  <Building2 className="size-4" />
                ) : (
                  customer.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{customer.name}</p>
                <p className="text-xs text-[#7b8680]">
                  {customer.document_type === "6" ? "RUC" : "DNI"} · {customer.document_number}
                </p>
              </div>
              <span
                className={`rounded-[7px] px-2 py-1 text-[10px] font-extrabold tracking-wide ${
                  customer.document_type === "6"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-[#f6f3ec] text-[#7b8680]"
                }`}
              >
                {customer.document_type === "6" ? "FACTURA" : "BOLETA"}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[15px] border-[1.5px] border-dashed border-[#d8d2c0] bg-white text-sm font-extrabold text-[#14201b]"
        >
          <Plus className="size-4" />
          Nuevo cliente
        </button>
      </div>
    </Modal>
  );
}
