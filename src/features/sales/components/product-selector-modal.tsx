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
      <div className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#7b8680]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto o código"
            className="h-12 w-full rounded-[14px] border-[1.5px] border-[#e8e3d7] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-orange-400"
          />
        </label>

        <div className="max-h-[55vh] overflow-y-auto rounded-[18px] border border-[#e8e3d7] bg-white px-3">
          {filtered.length ? (
            filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onAdd(product)}
                className="flex w-full items-center gap-3 border-b border-[#eee9df] py-3 text-left last:border-0 active:bg-[#fff9f2]"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-[#fff0e2] text-xl">
                  🍽️
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-[#14201b]">{product.name}</p>
                  <p className="erp-mono mt-0.5 text-[11px] text-[#7b8680]">{product.sku || "Sin SKU"}</p>
                </div>
                <div className="text-right">
                  <p className="erp-mono text-xs font-bold text-[#14201b]">{formatMoney(product.price)}</p>
                  <span className="mt-1 inline-flex size-9 items-center justify-center rounded-[12px] bg-orange-500 text-lg font-bold text-white shadow-[0_6px_14px_-6px_#e86400]">
                    +
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="py-10 text-center text-sm text-[#7b8680]">No encontramos productos.</p>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-[52px] w-full rounded-[16px] bg-orange-500 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_#e86400]"
        >
          Listo · {itemCount} {itemCount === 1 ? "producto" : "productos"} · {formatMoney(total)}
        </button>
      </div>
    </Modal>
  );
}
