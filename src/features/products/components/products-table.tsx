"use client";

import { Pencil } from "lucide-react";

import { formatBusinessDateTime } from "@/lib/date-time";
import type { Product } from "../types/product";
import { TAX_AFFECTATION_LABELS, formatProductPrice } from "../utils/product-format";
import { ProductStatusButton } from "./product-status-button";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15"
          : "bg-neutral-100 text-neutral-500 ring-neutral-500/10"
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

function ProductAvatar({ product }: { product: Product }) {
  const initial = product.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden="true"
      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
        product.active ? "bg-neutral-100 text-neutral-700" : "bg-neutral-50 text-neutral-400"
      }`}
    >
      {initial}
    </div>
  );
}

function Sku({ sku }: { sku: Product["sku"] }) {
  return sku ? (
    <p className="mt-0.5 font-mono text-xs text-neutral-500">{sku}</p>
  ) : (
    <p className="mt-0.5 text-xs italic text-neutral-400">Sin SKU</p>
  );
}

function RowActions({
  product,
  onEdit,
  block = false,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  block?: boolean;
}) {
  return (
    <div
      className={
        block
          ? "grid grid-cols-2 gap-2 [&>button]:justify-center [&>button]:border [&>button]:border-neutral-200 [&>button]:bg-white"
          : "flex items-center gap-1"
      }
    >
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
      <div className="hidden overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              <tr>
                <th scope="col" className="px-5 py-3">Producto</th>
                <th scope="col" className="px-5 py-3 text-right">Precio</th>
                <th scope="col" className="px-5 py-3">Unidad</th>
                <th scope="col" className="px-5 py-3">IGV</th>
                <th scope="col" className="px-5 py-3">Estado</th>
                <th scope="col" className="px-5 py-3">Actualizado</th>
                <th scope="col" className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-neutral-50/70">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <ProductAvatar product={product} />
                      <div className="min-w-0 max-w-xs">
                        <p
                          className={`truncate font-medium ${
                            product.active ? "text-neutral-900" : "text-neutral-500"
                          }`}
                        >
                          {product.name}
                        </p>
                        <Sku sku={product.sku} />
                      </div>
                    </div>
                  </td>
                  <td
                    className={`px-5 py-3.5 text-right font-semibold tabular-nums ${
                      product.active ? "text-neutral-900" : "text-neutral-500"
                    }`}
                  >
                    {formatProductPrice(product.price)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {product.unit_code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-600">
                    {TAX_AFFECTATION_LABELS[product.tax_affectation_code]}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge active={product.active} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs text-neutral-500">
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
          <article
            key={product.id}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <ProductAvatar product={product} />
              <div className="min-w-0 flex-1">
                <h2
                  className={`truncate font-medium ${
                    product.active ? "text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {product.name}
                </h2>
                <Sku sku={product.sku} />
              </div>
              <StatusBadge active={product.active} />
            </div>

            <div className="mt-4 flex items-end justify-between gap-3 rounded-lg bg-neutral-50 px-3.5 py-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  Precio
                </p>
                <p
                  className={`text-lg font-semibold tabular-nums ${
                    product.active ? "text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {formatProductPrice(product.price)}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5 text-xs">
                <span className="rounded-md bg-white px-2 py-0.5 font-medium text-neutral-600 ring-1 ring-neutral-200">
                  {product.unit_code}
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 font-medium text-neutral-600 ring-1 ring-neutral-200">
                  {TAX_AFFECTATION_LABELS[product.tax_affectation_code]}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs text-neutral-400">
              Actualizado {formatBusinessDateTime(product.updated_at)}
            </p>

            {isOwner ? (
              <div className="mt-3 border-t border-neutral-100 pt-3">
                <RowActions product={product} onEdit={onEdit} block />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}