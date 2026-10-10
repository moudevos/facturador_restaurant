"use client";

import { useMemo, useState } from "react";
import { Building2, Plus, Search, UserRound } from "lucide-react";

import type { Customer } from "@/features/sales/types/sales";
import { CustomerCreateModal } from "@/features/sales/components/customer-create-modal";

export function CustomersManager({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9f99]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, DNI o RUC"
            className="h-11 w-full rounded-[14px] border border-[#e8e3d7] bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-400"
          />
        </label>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400]"
        >
          <Plus className="size-4" />
          Nuevo cliente
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((customer) => (
          <article key={customer.id} className="flex items-center gap-3 rounded-[20px] border border-[#e8e3d7] bg-white p-4 ">
            <div className={`flex size-11 items-center justify-center rounded-full text-white ${
              customer.document_type === "6" ? "bg-blue-600" : "bg-neutral-900"
            }`}>
              {customer.document_type === "6" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-[#14201b]">{customer.name}</p>
              <p className="mt-1 text-xs text-[#7b8680]">
                {customer.document_type === "6" ? "RUC" : "DNI"} · {customer.document_number}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-[#e9e4d6] px-2.5 py-1 text-[10px] font-bold text-[#7b8680]">
              {customer.document_type === "6" ? "EMPRESA" : "PERSONA"}
            </span>
          </article>
        ))}
      </div>

      {!filtered.length ? (
        <div className="rounded-[20px] border border-dashed border-[#d8d2c0] bg-white py-12 text-center text-sm text-[#7b8680]">
          No hay clientes con ese criterio.
        </div>
      ) : null}

      <CustomerCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(customer) => setCustomers((current) => [customer, ...current])}
      />
    </div>
  );
}
