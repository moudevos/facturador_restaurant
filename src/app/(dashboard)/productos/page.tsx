import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { ProductsManager } from "@/features/products/components/products-manager";
import { getProductContext, listProducts } from "@/features/products/server/products";
import type { ProductStatusFilter } from "@/features/products/types/product";

function first(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
const STATUS_TABS: { value: ProductStatusFilter; label: string }[] = [{ value: "todos", label: "Todos" }, { value: "activo", label: "Activos" }, { value: "inactivo", label: "Inactivos" }];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await getProductContext(); if (!context) redirect("/configuracion");
  const params = await searchParams; const query = first(params.q).trim().slice(0, 120); const rawStatus = first(params.estado); const status: ProductStatusFilter = rawStatus === "activo" || rawStatus === "inactivo" ? rawStatus : "todos"; const page = Math.max(1, Number.parseInt(first(params.page), 10) || 1);
  const { products, count, error } = await listProducts({ organizationId: context.organizationId, query, status, page });
  const buildUrl = (target: { status?: ProductStatusFilter }) => `/productos?${new URLSearchParams({ ...(query ? { q: query } : {}), ...((target.status ?? status) !== "todos" ? { estado: target.status ?? status } : {}) })}`;
  return <section className="space-y-6"><header><h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Productos</h1><p className="mt-1 text-sm text-neutral-500">Catálogo comercial utilizado para ventas y comprobantes.</p></header><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><nav aria-label="Filtrar por estado" className="inline-flex w-fit rounded-lg bg-neutral-100 p-1">{STATUS_TABS.map((tab) => <Link key={tab.value} href={buildUrl({ status: tab.value })} aria-current={status === tab.value ? "page" : undefined} className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition ${status === tab.value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}>{tab.label}</Link>)}</nav><form className="flex w-full gap-2 sm:max-w-sm" role="search">{status !== "todos" ? <input type="hidden" name="estado" value={status} /> : null}<div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" /><input name="q" defaultValue={query} placeholder="Buscar por nombre o SKU" aria-label="Buscar productos" className="h-10 w-full rounded-lg border border-neutral-200 bg-white pl-10 pr-3 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5" /></div><button type="submit" className="h-10 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Buscar</button></form></div><ProductsManager query={query} status={status} page={page} isOwner={context.role === "owner"} initialData={{ products, count, errorMessage: error ? "No pudimos cargar los productos. Intenta nuevamente." : null }} /></section>;
}
