"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";

import { Modal } from "@/components/modal";
import type { Product } from "@/features/products/types/product";
import { formatMoney } from "../utils/format";

export function ProductSelectorModal({
  open,
  products,
  onClose,
  onAdd,
  itemCount,
  total,
}: {
  open: boolean;
  products: Product[];
  onClose: () => void;
  onAdd: (product: Product) => void;
  itemCount: number;
  total: number;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        (product.sku ?? "").toLowerCase().includes(term),
    );
  }, [products, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar productos"
      description="Busca por nombre o SKU."
      icon={PackagePlus}
      size="lg"
    >
      <div className="space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto o código"
            className="h-11 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-sm outline-none focus:border-orange-400"
          />
        </label>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => onAdd(product)}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition hover:border-orange-300 hover:bg-orange-50/40"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <PackagePlus className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{product.name}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{product.sku || "Sin SKU"}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{formatMoney(product.price)}</p>
                <span className="mt-1 inline-flex size-7 items-center justify-center rounded-lg bg-neutral-900 text-white">+</span>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-12 w-full rounded-xl bg-orange-500 text-sm font-semibold text-white"
        >
          Listo · {itemCount} {itemCount === 1 ? "producto" : "productos"} · {formatMoney(total)}
        </button>
      </div>
    </Modal>
  );
}
