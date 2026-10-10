"use client";

import { Pencil } from "lucide-react";

import { formatBusinessDateTime } from "@/lib/date-time";
import type { Product } from "../types/product";
import { TAX_AFFECTATION_LABELS, formatProductPrice } from "../utils/product-format";
import { ProductStatusButton } from "./product-status-button";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-neutral-400"}`}
        aria-hidden="true"
      />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function RowActions({
  product,
  onEdit,
}: {
  product: Product;
  onEdit: (product: Product) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Editar
      </button>
      <ProductStatusButton id={product.id} active={product.active} />
    </div>
  );
}

export function ProductsTable({
  products,
  isOwner,
  onEdit,
}: {
  products: Product[];
  isOwner: boolean;
  onEdit: (product: Product) => void;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/70 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Producto</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Precio</th>
                <th scope="col" className="px-5 py-3 font-medium">Unidad</th>
                <th scope="col" className="px-5 py-3 font-medium">IGV</th>
                <th scope="col" className="px-5 py-3 font-medium">Estado</th>
                <th scope="col" className="px-5 py-3 font-medium">Actualizado</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-neutral-900">{product.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{product.sku ?? "Sin SKU"}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium tabular-nums text-neutral-900">
                    {formatProductPrice(product.price)}
                  </td>
                  <td className="px-5 py-3.5 text-neutral-600">{product.unit_code}</td>
                  <td className="px-5 py-3.5 text-neutral-600">
                    {TAX_AFFECTATION_LABELS[product.tax_affectation_code]}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge active={product.active} /></td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-neutral-500">
                    {formatBusinessDateTime(product.updated_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    {isOwner ? (
                      <div className="flex justify-end">
                        <RowActions product={product} onEdit={onEdit} />
                      </div>
                    ) : (
                      <span className="block text-right text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {products.map((product) => (
          <article key={product.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-medium text-neutral-900">{product.name}</h2>
                <p className="mt-0.5 text-xs text-neutral-500">{product.sku ?? "Sin SKU"}</p>
              </div>
              <StatusBadge active={product.active} />
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-3">
              <p className="text-base font-semibold tabular-nums text-neutral-900">
                {formatProductPrice(product.price)}
              </p>
              <p className="text-xs text-neutral-500">
                {product.unit_code} · {TAX_AFFECTATION_LABELS[product.tax_affectation_code]}
              </p>
            </div>

            {isOwner ? (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <RowActions product={product} onEdit={onEdit} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
