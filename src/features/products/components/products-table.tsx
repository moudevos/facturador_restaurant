"use client";

import { Pencil } from "lucide-react";

import { formatBusinessDateTime } from "@/lib/date-time";
import type { Product } from "../types/product";
import { TAX_AFFECTATION_LABELS, formatProductPrice } from "../utils/product-format";
import { ProductStatusButton } from "./product-status-button";

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[#e9e4d6] text-[#7b8680]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[#9b9f99]"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function ProductAvatar({ product }: { product: Product }) {
  const initial = product.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[#fff0e2] text-sm font-extrabold text-orange-600">
      {initial}
    </div>
  );
}

function ProductCodes({ product }: { product: Product }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className="erp-mono rounded-[6px] bg-[#14201b] px-1.5 py-0.5 text-[10px] font-bold text-white">
        {product.product_code}
      </span>
      {product.sku ? (
        <span className="erp-mono text-[10px] font-bold text-[#7b8680]">{product.sku}</span>
      ) : null}
    </div>
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
    <div className={block ? "grid grid-cols-2 gap-2" : "flex items-center gap-1"}>
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[12px] border border-[#e8e3d7] bg-white px-3 text-sm font-bold text-[#59665f]"
      >
        <Pencil className="size-3.5" />
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
      <div className="hidden overflow-hidden rounded-[18px] border border-[#e8e3d7] bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e8e3d7] bg-[#f6f3ec] text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
              <tr>
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3 text-right">Precio</th>
                <th className="px-5 py-3">IGV</th>
                <th className="px-5 py-3">SUNAT</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee9df]">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-[#fbfaf6]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <ProductAvatar product={product} />
                      <div className="min-w-0 max-w-xs">
                        <p className="truncate font-bold text-[#14201b]">{product.name}</p>
                        <ProductCodes product={product} />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-full bg-[#fff0e2] px-2.5 py-1 text-[11px] font-bold text-orange-700">
                      {product.category?.name || "Sin categoría"}
                    </span>
                  </td>
                  <td className="erp-mono px-5 py-3.5 text-right font-bold text-[#14201b]">
                    {formatProductPrice(product.price)}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#59665f]">
                    {TAX_AFFECTATION_LABELS[product.tax_affectation_code]}
                  </td>
                  <td className="px-5 py-3.5">
                    {product.sunat_product_code ? (
                      <span className="erp-mono text-xs font-bold text-emerald-700">
                        {product.sunat_product_code}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">Pendiente</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge active={product.active} />
                  </td>
                  <td className="px-5 py-3.5">
                    {isOwner ? (
                      <div className="flex justify-end">
                        <RowActions product={product} onEdit={onEdit} />
                      </div>
                    ) : (
                      <span className="block text-right text-[#c6c0b3]">—</span>
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
            className="rounded-[18px] border border-[#e8e3d7] bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <ProductAvatar product={product} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-extrabold text-[#14201b]">{product.name}</h2>
                <ProductCodes product={product} />
              </div>
              <StatusBadge active={product.active} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[#fff0e2] px-2.5 py-1 text-[11px] font-bold text-orange-700">
                {product.category?.name || "Sin categoría"}
              </span>
              <span className="rounded-full bg-[#f6f3ec] px-2.5 py-1 text-[11px] font-bold text-[#59665f]">
                {TAX_AFFECTATION_LABELS[product.tax_affectation_code]}
              </span>
              {product.sunat_product_code ? (
                <span className="erp-mono rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  SUNAT {product.sunat_product_code}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex items-end justify-between rounded-[13px] bg-[#f6f3ec] px-3.5 py-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#9b9f99]">
                  Precio
                </p>
                <p className="erp-mono mt-1 text-lg font-bold text-[#14201b]">
                  {formatProductPrice(product.price)}
                </p>
              </div>
              <p className="text-[10px] text-[#9b9f99]">
                {formatBusinessDateTime(product.updated_at)}
              </p>
            </div>

            {isOwner ? (
              <div className="mt-3 border-t border-[#eee9df] pt-3">
                <RowActions product={product} onEdit={onEdit} block />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
