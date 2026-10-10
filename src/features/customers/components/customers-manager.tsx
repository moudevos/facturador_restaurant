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
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, DNI o RUC"
            className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-400"
          />
        </label>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white"
        >
          <Plus className="size-4" />
          Nuevo cliente
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((customer) => (
          <article key={customer.id} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className={`flex size-11 items-center justify-center rounded-full text-white ${
              customer.document_type === "6" ? "bg-blue-600" : "bg-neutral-900"
            }`}>
              {customer.document_type === "6" ? <Building2 className="size-4" /> : <UserRound className="size-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-neutral-900">{customer.name}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {customer.document_type === "6" ? "RUC" : "DNI"} · {customer.document_number}
                {customer.phone ? ` · ${customer.phone}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
              {customer.document_type === "6" ? "EMPRESA" : "PERSONA"}
            </span>
          </article>
        ))}
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
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
