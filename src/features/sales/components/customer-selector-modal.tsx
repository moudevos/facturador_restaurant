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
      <div className="space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, DNI o RUC"
            className="h-11 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-sm outline-none focus:border-orange-400"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
            selectedId === null ? "border-orange-400 bg-orange-50" : "border-neutral-200"
          }`}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-neutral-900 text-white">
            <UserRound className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Cliente varios</p>
            <p className="text-xs text-neutral-500">Boleta sin documento</p>
          </div>
        </button>

        <div className="max-h-[48vh] space-y-2 overflow-y-auto">
          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => {
                onSelect(customer);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                selectedId === customer.id ? "border-orange-400 bg-orange-50" : "border-neutral-200"
              }`}
            >
              <div className={`flex size-10 items-center justify-center rounded-full text-white ${
                customer.document_type === "6" ? "bg-blue-600" : "bg-neutral-900"
              }`}>
                {customer.document_type === "6" ? <Building2 className="size-4" /> : customer.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{customer.name}</p>
                <p className="text-xs text-neutral-500">
                  {customer.document_type === "6" ? "RUC" : "DNI"} · {customer.document_number}
                </p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-semibold text-neutral-500">
                {customer.document_type === "6" ? "FACTURA" : "BOLETA"}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          <Plus className="size-4" />
          Nuevo cliente
        </button>
      </div>
    </Modal>
  );
}
