import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { ProductsManager } from "@/features/products/components/products-manager";
import {
  getProductContext,
  listProductCategories,
  listProducts,
} from "@/features/products/server/products";
import type { ProductStatusFilter } from "@/features/products/types/product";

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

const STATUS_TABS: { value: ProductStatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activo", label: "Activos" },
  { value: "inactivo", label: "Inactivos" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getProductContext();
  if (!context) redirect("/configuracion");

  const params = await searchParams;
  const query = first(params.q).trim().slice(0, 120);
  const rawStatus = first(params.estado);
  const status: ProductStatusFilter =
    rawStatus === "activo" || rawStatus === "inactivo" ? rawStatus : "todos";
  const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);

  const categories = await listProductCategories(context.organizationId);
  const requestedCategory = first(params.categoria);
  const categoryId = categories.some((category) => category.id === requestedCategory)
    ? requestedCategory
    : "";

  const { products, count, error } = await listProducts({
    organizationId: context.organizationId,
    query,
    status,
    categoryId,
    page,
  });

  function url(next: {
    status?: ProductStatusFilter;
    categoryId?: string;
  }) {
    const nextStatus = next.status ?? status;
    const nextCategory = next.categoryId ?? categoryId;
    return `/productos?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(nextStatus !== "todos" ? { estado: nextStatus } : {}),
      ...(nextCategory ? { categoria: nextCategory } : {}),
    })}`;
  }

  return (
    <section className="space-y-5 sm:space-y-6">
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
          Catálogo
        </p>
        <h1 className="mt-1 text-[23px] font-extrabold tracking-[-0.02em] text-[#14201b] sm:text-[27px]">
          Productos
        </h1>
        <p className="mt-1.5 text-[13px] text-[#7b8680]">
          Códigos internos, categorías, precios y configuración fiscal del POS.
        </p>
      </header>

      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href={url({ categoryId: "" })}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${
              !categoryId
                ? "bg-[#14201b] text-white"
                : "border border-[#e8e3d7] bg-white text-[#59665f]"
            }`}
          >
            Todas
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={url({ categoryId: category.id })}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold ${
                categoryId === category.id
                  ? "bg-orange-500 text-white"
                  : "border border-[#e8e3d7] bg-white text-[#59665f]"
              }`}
            >
              {category.name}
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav
            aria-label="Filtrar por estado"
            className="inline-flex w-fit rounded-[14px] bg-[#e9e4d6] p-1"
          >
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={url({ status: tab.value })}
                className={`inline-flex h-9 items-center rounded-[11px] px-3 text-sm font-bold transition ${
                  status === tab.value
                    ? "bg-white text-[#14201b] shadow-sm"
                    : "text-[#7b8680]"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <form className="flex w-full gap-2 sm:max-w-md" role="search">
            {status !== "todos" ? <input type="hidden" name="estado" value={status} /> : null}
            {categoryId ? <input type="hidden" name="categoria" value={categoryId} /> : null}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9f99]" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Nombre, código o SKU"
                className="h-11 w-full rounded-[14px] border border-[#e8e3d7] bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-500"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-[14px] border border-[#e8e3d7] bg-white px-4 text-sm font-bold text-[#35423c]"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      <ProductsManager
        query={query}
        status={status}
        categoryId={categoryId}
        page={page}
        isOwner={context.role === "owner"}
        categories={categories}
        initialData={{
          products,
          count,
          errorMessage: error
            ? "No pudimos cargar los productos. Verifica que SQL 012 esté aplicado."
            : null,
        }}
      />
    </section>
  );
}
