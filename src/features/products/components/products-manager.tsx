"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  PackageSearch,
  Plus,
} from "lucide-react";

import { useFeedback } from "@/components/feedback";
import {
  createProductAction,
  updateProductAction,
  type ProductActionResult,
} from "../server/actions";
import { listProductsAction } from "../server/list-action";
import { PRODUCTS_PER_PAGE, type Product, type ProductStatusFilter } from "../types/product";
import { ProductCreateModal } from "./product-create-modal";
import { ProductEditModal } from "./product-edit-modal";
import { ProductsTable } from "./products-table";

type ProductsData = {
  products: Product[];
  count: number;
  errorMessage: string | null;
};

const pageButton =
  "inline-flex h-10 items-center gap-1 rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-sm font-bold text-[#35423c] transition-colors hover:bg-[#fbfaf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50";
const pageButtonDisabled =
  "inline-flex h-10 cursor-not-allowed items-center gap-1 rounded-[13px] border border-[#eee9df] bg-[#f6f3ec] px-3 text-sm font-bold text-[#c6c0b3]";
const primaryButton =
  "inline-flex h-12 items-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300/50";

export function ProductsManager({
  query,
  status,
  page,
  isOwner,
  initialData,
}: {
  query: string;
  status: ProductStatusFilter;
  page: number;
  isOwner: boolean;
  initialData: ProductsData;
}) {
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const productsQuery = useQuery({
    queryKey: ["products", { q: query, status, page }],
    queryFn: () => listProductsAction(query, status, page),
    initialData,
  });

  const createMutation = useMutation({
    mutationFn: createProductAction,
    onSuccess: async (result) => {
      if (!result.success) return;
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setCreateOpen(false);
      toast.success(result.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      updateProductAction(id, formData),
    onSuccess: async (result) => {
      if (!result.success) return;
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditingProduct(null);
      toast.success(result.message);
    },
  });

  const data = productsQuery.data;
  const isRefreshing = productsQuery.isFetching;
  const hasFilters = Boolean(query) || status !== "todos";
  const totalPages = Math.max(1, Math.ceil(data.count / PRODUCTS_PER_PAGE));
  const from = data.products.length ? (page - 1) * PRODUCTS_PER_PAGE + 1 : 0;
  const to = from + data.products.length - 1;

  const href = (target: number) =>
    `/productos?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status !== "todos" ? { estado: status } : {}),
      ...(target > 1 ? { page: String(target) } : {}),
    })}`;

  const create = async (formData: FormData): Promise<ProductActionResult> =>
    createMutation.mutateAsync(formData);

  const update = async (formData: FormData): Promise<ProductActionResult> => {
    if (!editingProduct) {
      return { success: false, message: "No se encontró el producto a editar." };
    }

    return updateMutation.mutateAsync({ id: editingProduct.id, formData });
  };

  return (
    <div className="space-y-5">
      {(isOwner || !data.errorMessage) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-[#7b8680]">
            {!data.errorMessage && (
              <p>
                <span className="font-semibold text-[#14201b]">{data.count}</span>{" "}
                {hasFilters
                  ? data.count === 1
                    ? "resultado"
                    : "resultados"
                  : data.count === 1
                    ? "producto"
                    : "productos"}
              </p>
            )}
            {isRefreshing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#9b9f99]" aria-live="polite">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Actualizando…
              </span>
            )}
          </div>

          {isOwner ? (
            <button type="button" onClick={() => setCreateOpen(true)} className={primaryButton}>
              <Plus className="size-4" aria-hidden="true" />
              Nuevo producto
            </button>
          ) : null}
        </div>
      )}

      {data.errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[14px] border border-red-200 bg-red-50/70 p-4 text-sm"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="size-4" aria-hidden="true" />
          </div>
          <div className="pt-0.5">
            <p className="font-medium text-red-900">No se pudieron cargar los productos</p>
            <p className="mt-0.5 text-red-700">{data.errorMessage}</p>
          </div>
        </div>
      ) : data.products.length ? (
        <>
          <div aria-busy={isRefreshing}>
            <ProductsTable products={data.products} isOwner={isOwner} onEdit={setEditingProduct} />
          </div>

          <nav
            aria-label="Paginación"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <p className="text-[#7b8680]">
              Mostrando{" "}
              <span className="font-medium text-[#14201b]">
                {from}–{to}
              </span>{" "}
              de <span className="font-medium text-[#14201b]">{data.count}</span>
              <span className="mx-1.5 text-[#c6c0b3]">·</span>
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={href(page - 1)} className={`${pageButton} pl-2`}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Anterior
                </Link>
              ) : (
                <span aria-disabled="true" className={`${pageButtonDisabled} pl-2`}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Anterior
                </span>
              )}
              {page < totalPages ? (
                <Link href={href(page + 1)} className={`${pageButton} pr-2`}>
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              ) : (
                <span aria-disabled="true" className={`${pageButtonDisabled} pr-2`}>
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              )}
            </div>
          </nav>
        </>
      ) : (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-[#d8d2c0] bg-white px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[#e9e4d6] text-[#7b8680] ring-8 ring-neutral-50">
            <PackageSearch className="size-6" aria-hidden="true" />
          </div>
          <p className="mt-5 text-base font-semibold text-[#14201b]">
            {hasFilters ? "Sin resultados" : "Aún no hay productos"}
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-[#7b8680]">
            {hasFilters
              ? "No encontramos productos con esos filtros. Prueba con otra búsqueda."
              : "Registra tu primer producto para empezar a vender."}
          </p>
          {hasFilters ? (
            <Link href="/productos" className={`${pageButton} mt-6 h-10 px-4`}>
              Limpiar filtros
            </Link>
          ) : isOwner ? (
            <button type="button" onClick={() => setCreateOpen(true)} className={`${primaryButton} mt-6`}>
              <Plus className="size-4" aria-hidden="true" />
              Crear primer producto
            </button>
          ) : null}
        </div>
      )}

      <ProductCreateModal
        open={createOpen}
        isSaving={createMutation.isPending}
        onClose={() => setCreateOpen(false)}
        onCreate={create}
        onCreated={() => undefined}
      />

      {editingProduct ? (
        <ProductEditModal
          product={editingProduct}
          open
          isSaving={updateMutation.isPending}
          onClose={() => setEditingProduct(null)}
          onUpdate={update}
        />
      ) : null}
    </div>
  );
}