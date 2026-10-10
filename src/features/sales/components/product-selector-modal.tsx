"use client";

import { useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";

import { Modal } from "@/components/modal";
import type { Product } from "@/features/products/types/product";
import { formatMoney } from "../utils/format";

const CATEGORY_EMOJI: Record<string, string> = {
  BEBIDAS: "🥤",
  COMIDAS: "🍽️",
  HAMBURGUESAS: "🍔",
  SALCHIPAPAS: "🍟",
  BROASTER: "🍗",
  COMBOS: "🍱",
  ACOMPANAMIENTOS: "🥔",
  OTROS: "📦",
};

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
  const [categoryId, setCategoryId] = useState("");

  const categories = useMemo(() => {
    const map = new Map<string, NonNullable<Product["category"]>>();
    for (const product of products) {
      if (product.category) map.set(product.category.id, product.category);
    }
    return [...map.values()].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }, [products]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryId && product.category_id !== categoryId) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.product_code.toLowerCase().includes(term) ||
        (product.sku ?? "").toLowerCase().includes(term)
      );
    });
  }, [categoryId, products, query]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar productos"
      description="Busca por nombre, código interno o SKU."
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
            className="h-12 w-full rounded-[14px] border-[1.5px] border-[#e8e3d7] bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-500"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryId("")}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${
              !categoryId ? "bg-[#14201b] text-white" : "bg-[#f6f3ec] text-[#59665f]"
            }`}
          >
            Todo
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${
                categoryId === category.id
                  ? "bg-orange-500 text-white"
                  : "bg-[#f6f3ec] text-[#59665f]"
              }`}
            >
              {CATEGORY_EMOJI[category.code] ?? "🍽️"} {category.name}
            </button>
          ))}
        </div>

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
                  {CATEGORY_EMOJI[product.category?.code ?? ""] ?? "🍽️"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-[#14201b]">
                    {product.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="erp-mono rounded-[6px] bg-[#14201b] px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {product.product_code}
                    </span>
                    {product.sku ? (
                      <span className="erp-mono text-[10px] font-bold text-[#7b8680]">
                        {product.sku}
                      </span>
                    ) : null}
                    {product.category ? (
                      <span className="text-[10px] font-semibold text-orange-700">
                        {product.category.name}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="erp-mono text-xs font-bold text-[#14201b]">
                    {formatMoney(product.price)}
                  </p>
                  <span className="mt-1 inline-flex size-9 items-center justify-center rounded-[12px] bg-orange-500 text-lg font-bold text-white">
                    +
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="py-10 text-center text-sm text-[#7b8680]">
              No encontramos productos en esta categoría.
            </p>
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
