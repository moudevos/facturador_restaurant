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
import {
  PRODUCTS_PER_PAGE,
  type Product,
  type ProductCategory,
  type ProductStatusFilter,
} from "../types/product";
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
  categoryId,
  page,
  isOwner,
  categories,
  initialData,
}: {
  query: string;
  status: ProductStatusFilter;
  categoryId: string;
  page: number;
  isOwner: boolean;
  categories: ProductCategory[];
  initialData: ProductsData;
}) {
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const productsQuery = useQuery({
    queryKey: ["products", { q: query, status, categoryId, page }],
    queryFn: () => listProductsAction(query, status, categoryId, page),
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
  const hasFilters = Boolean(query) || status !== "todos" || Boolean(categoryId);
  const totalPages = Math.max(1, Math.ceil(data.count / PRODUCTS_PER_PAGE));
  const from = data.products.length ? (page - 1) * PRODUCTS_PER_PAGE + 1 : 0;
  const to = from + data.products.length - 1;

  const href = (target: number) =>
    `/productos?${new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(status !== "todos" ? { estado: status } : {}),
      ...(categoryId ? { categoria: categoryId } : {}),
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
            {!data.errorMessage ? (
              <p>
                <span className="font-extrabold text-[#14201b]">{data.count}</span>{" "}
                {data.count === 1 ? "producto" : "productos"}
              </p>
            ) : null}
            {isRefreshing ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#9b9f99]">
                <LoaderCircle className="size-3.5 animate-spin" />
                Actualizando…
              </span>
            ) : null}
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={primaryButton}
            >
              <Plus className="size-4" />
              Nuevo producto
            </button>
          ) : null}
        </div>
      )}

      {data.errorMessage ? (
        <div className="flex items-start gap-3 rounded-[14px] border border-red-200 bg-red-50/70 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <p className="text-red-800">{data.errorMessage}</p>
        </div>
      ) : data.products.length ? (
        <>
          <div aria-busy={isRefreshing}>
            <ProductsTable
              products={data.products}
              isOwner={isOwner}
              onEdit={setEditingProduct}
            />
          </div>

          <nav
            aria-label="Paginación"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <p className="text-[#7b8680]">
              {from}–{to} de {data.count} · Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={href(page - 1)} className={pageButton}>
                  <ChevronLeft className="size-4" />
                  Anterior
                </Link>
              ) : (
                <span className={pageButtonDisabled}>
                  <ChevronLeft className="size-4" />
                  Anterior
                </span>
              )}
              {page < totalPages ? (
                <Link href={href(page + 1)} className={pageButton}>
                  Siguiente
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <span className={pageButtonDisabled}>
                  Siguiente
                  <ChevronRight className="size-4" />
                </span>
              )}
            </div>
          </nav>
        </>
      ) : (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-[#d8d2c0] bg-white px-6 py-16 text-center">
          <PackageSearch className="size-7 text-[#9b9f99]" />
          <p className="mt-4 font-extrabold text-[#14201b]">
            {hasFilters ? "Sin resultados" : "Aún no hay productos"}
          </p>
          <p className="mt-1 text-sm text-[#7b8680]">
            {hasFilters
              ? "Prueba otra búsqueda, categoría o estado."
              : "Registra tu primer producto para empezar a vender."}
          </p>
        </div>
      )}

      <ProductCreateModal
        open={createOpen}
        categories={categories}
        isSaving={createMutation.isPending}
        onClose={() => setCreateOpen(false)}
        onCreate={create}
        onCreated={() => undefined}
      />

      {editingProduct ? (
        <ProductEditModal
          product={editingProduct}
          categories={categories}
          open
          isSaving={updateMutation.isPending}
          onClose={() => setEditingProduct(null)}
          onUpdate={update}
        />
      ) : null}
    </div>
  );
}
