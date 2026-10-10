"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Minus,
  PackagePlus,
  Plus,
  ReceiptText,
  ShoppingCart,
  Trash2,
  UserRound,
} from "lucide-react";

import { useFeedback } from "@/components/feedback";
import type { Product } from "@/features/products/types/product";
import { createPosSaleAction } from "../server/actions";
import type { Customer, DocumentType, PaymentMethod } from "../types/sales";
import { formatMoney, sessionCode } from "../utils/format";
import { usePosStore } from "../store/pos-store";
import { CustomerCreateModal } from "./customer-create-modal";
import { CustomerSelectorModal } from "./customer-selector-modal";
import { PaymentModal } from "./payment-modal";
import { ProductSelectorModal } from "./product-selector-modal";
import { SaleCompleteModal } from "./sale-complete-modal";

type Sequence = {
  id: string;
  document_type: string;
  series: string;
  current_value: number;
};

export function PosClient({
  sessionId,
  tradeName,
  branchName,
  products,
  initialCustomers,
  sequences,
}: {
  sessionId: string;
  tradeName: string;
  branchName: string;
  products: Product[];
  initialCustomers: Customer[];
  sequences: Sequence[];
}) {
  const { toast, withLoading } = useFeedback();
  const {
    items,
    step,
    customer,
    documentType,
    addProduct,
    increase,
    decrease,
    remove,
    setStep,
    setCustomer,
    setDocumentType,
    resetSale,
  } = usePosStore();

  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [customerSelectorOpen, setCustomerSelectorOpen] = useState(false);
  const [customerCreateOpen, setCustomerCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [customers, setCustomers] = useState(initialCustomers);
  const [pendingPayment, setPendingPayment] = useState(false);
  const [completedSale, setCompletedSale] = useState<Awaited<ReturnType<typeof createPosSaleAction>>["data"] | null>(null);

  const totals = useMemo(() => {
    let total = 0;
    let subtotal = 0;
    let igv = 0;

    for (const item of items) {
      const line = Number(item.product.price) * item.quantity;
      total += line;
      if (item.product.tax_affectation_code === "10") {
        const base = line / 1.18;
        subtotal += base;
        igv += line - base;
      } else {
        subtotal += line;
      }
    }

    return {
      total: Math.round(total * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      igv: Math.round(igv * 100) / 100,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [items]);

  const activeSeries = sequences.filter(
    (sequence) => sequence.document_type === documentType,
  );
  const selectedSeries = activeSeries[0]?.series ?? null;
  const canInvoice = customer?.document_type === "6";
  const canCharge =
    items.length > 0 &&
    Boolean(selectedSeries) &&
    (documentType === "03" || canInvoice);
  const initial = tradeName.trim().charAt(0).toUpperCase() || "R";

  function chooseCustomer(next: Customer | null) {
    setCustomer(next);
  }

  async function charge(paymentMethod: PaymentMethod, receivedAmount: number | null) {
    if (!selectedSeries || !canCharge || pendingPayment) return;
    setPendingPayment(true);

    try {
      const result = await withLoading(
        () =>
          createPosSaleAction({
            sessionId,
            documentType,
            series: selectedSeries,
            customerId: customer?.id ?? null,
            items: items.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
            })),
            paymentMethod,
            receivedAmount,
          }),
        {
          title: "Validando y emitiendo",
          message: "Calculando importes, registrando el cobro y enviando a Intifact...",
        },
      );

      if (!result.success || !result.data) {
        toast.error(result.message);
        return;
      }

      setPaymentOpen(false);
      setCompletedSale(result.data);
    } finally {
      setPendingPayment(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#f6f3ec] text-[#14201b]">
      <header className="sticky top-0 z-20 rounded-b-[26px] bg-[#14201b] text-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 pb-4 pt-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-orange-500 text-sm font-extrabold">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-extrabold leading-tight">{tradeName}</p>
                <p className="mt-0.5 truncate text-[10px] text-[#9fb0a8] sm:text-[11px]">
                  {branchName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-bold text-[#b6c4be] transition hover:bg-white/10 hover:text-white"
            >
              Cerrar POS
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9fb0a8]">
                Total a cobrar
              </p>
              <p className="erp-mono mt-0.5 text-[32px] font-bold leading-none tracking-[-0.04em] text-orange-400 sm:text-[36px]">
                {formatMoney(totals.total)}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-extrabold text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                SESIÓN ABIERTA
              </span>
              <p className="erp-mono mt-1.5 text-[10px] text-[#9fb0a8]">
                {sessionCode(sessionId)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-5 lg:pb-32 lg:pt-6">
        <div className="mb-4 grid grid-cols-2 rounded-[15px] bg-[#e9e4d6] p-1">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`h-10 rounded-[11px] text-sm font-bold transition ${
              step === 1 ? "bg-white text-[#14201b] shadow-sm" : "text-[#7b8680]"
            }`}
          >
            1 · Carrito
          </button>
          <button
            type="button"
            disabled={!items.length}
            onClick={() => setStep(2)}
            className={`h-10 rounded-[11px] text-sm font-bold transition disabled:opacity-40 ${
              step === 2 ? "bg-white text-[#14201b] shadow-sm" : "text-[#7b8680]"
            }`}
          >
            2 · Cierre
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 lg:space-y-0">
            <button
              type="button"
              onClick={() => setProductSelectorOpen(true)}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#ffb27a] bg-[#fff0e2] text-sm font-extrabold text-[#e86400] transition active:scale-[.99] lg:col-start-1"
            >
              <PackagePlus className="size-5" />
              Agregar productos
            </button>

            <section className="rounded-[18px] border border-[#e8e3d7] bg-white p-3.5 sm:p-4 lg:col-start-1">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[17px] font-extrabold">Carrito</h2>
                <span className="text-xs font-bold text-[#7b8680]">
                  {items.length} {items.length === 1 ? "producto" : "productos"}
                </span>
              </div>

              {items.length ? (
                <div className="divide-y divide-[#eee9df]">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-2.5 py-3 sm:gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-[#fff0e2] text-lg">
                        🍽️
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{item.product.name}</p>
                        <p className="erp-mono mt-0.5 text-[11px] text-[#7b8680]">
                          {formatMoney(item.product.price)} c/u
                        </p>
                        <p className="erp-mono mt-1 text-xs font-bold">
                          {formatMoney(Number(item.product.price) * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 rounded-[12px] bg-[#f6f3ec] p-1">
                        {item.quantity === 1 ? (
                          <button
                            type="button"
                            onClick={() => remove(item.product.id)}
                            aria-label={`Eliminar ${item.product.name}`}
                            className="flex size-8 items-center justify-center rounded-[9px] bg-white text-red-600 shadow-sm"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => decrease(item.product.id)}
                            aria-label={`Reducir ${item.product.name}`}
                            className="flex size-8 items-center justify-center rounded-[9px] bg-white shadow-sm"
                          >
                            <Minus className="size-3.5" />
                          </button>
                        )}
                        <span className="erp-mono min-w-7 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => increase(item.product.id)}
                          aria-label={`Aumentar ${item.product.name}`}
                          className="flex size-8 items-center justify-center rounded-[9px] bg-white shadow-sm"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="mx-auto flex size-[72px] items-center justify-center rounded-full border-2 border-dashed border-[#ffb27a] bg-[#fff0e2]">
                    <ShoppingCart className="size-7 text-orange-500" />
                  </div>
                  <p className="mt-4 text-sm font-extrabold">El carrito está vacío</p>
                  <p className="mt-1 text-xs text-[#7b8680]">Agrega productos para comenzar la venta.</p>
                </div>
              )}
            </section>

            {items.length ? (
              <section className="rounded-[18px] border border-[#e8e3d7] bg-white p-4 lg:sticky lg:top-[150px] lg:col-start-2 lg:row-start-1 lg:row-span-2">
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">
                  Resumen del pedido
                </p>
                <SummaryLine label="Subtotal" value={totals.subtotal} />
                <SummaryLine label="IGV" value={totals.igv} />
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#d8d2c0] pt-3">
                  <span className="font-extrabold">Total</span>
                  <span className="erp-mono text-xl font-bold">{formatMoney(totals.total)}</span>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#7b8680]"
            >
              <ArrowLeft className="size-4" />
              Volver al pedido
            </button>

            <section className="rounded-[18px] border border-[#e8e3d7] bg-white p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">Pedido</p>
                  <p className="mt-1 text-sm font-extrabold">{totals.quantity} unidades</p>
                </div>
                <p className="erp-mono text-xl font-bold">{formatMoney(totals.total)}</p>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setCustomerSelectorOpen(true)}
              className="flex w-full items-center gap-3 rounded-[20px] border-[1.5px] border-[#e8e3d7] bg-white p-4 text-left transition active:scale-[.99]"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-[#fff0e2] text-orange-600">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">Cliente</p>
                <p className="mt-1 truncate text-[15px] font-extrabold">{customer?.name || "Cliente varios"}</p>
                <p className="mt-0.5 text-xs text-[#7b8680]">
                  {customer
                    ? `${customer.document_type === "6" ? "RUC" : "DNI"} · ${customer.document_number}`
                    : "Opcional · sin documento"}
                </p>
              </div>
              <ChevronRight className="size-5 text-[#a7aca7]" />
            </button>

            <section className="rounded-[20px] border-[1.5px] border-[#e8e3d7] bg-white p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#7b8680]">Comprobante</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDocumentType("03")}
                  className={`h-12 rounded-[14px] border-[1.5px] text-sm font-extrabold transition ${
                    documentType === "03"
                      ? "border-orange-500 bg-[#fff0e2] text-[#e86400]"
                      : "border-[#e8e3d7] bg-white"
                  }`}
                >
                  Boleta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (canInvoice) setDocumentType("01");
                    else toast.warning("Selecciona un cliente con RUC para emitir factura.");
                  }}
                  className={`h-12 rounded-[14px] border-[1.5px] text-sm font-extrabold transition ${
                    documentType === "01"
                      ? "border-orange-500 bg-[#fff0e2] text-[#e86400]"
                      : "border-[#e8e3d7] bg-white"
                  } ${!canInvoice ? "opacity-45" : ""}`}
                >
                  Factura
                </button>
              </div>
              <p className="mt-3 text-xs text-[#7b8680]">
                Serie: <span className="font-extrabold text-[#14201b]">{selectedSeries || "Sin serie activa"}</span>
              </p>
            </section>

            {!selectedSeries ? (
              <div className="rounded-[15px] border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Configura una serie activa para este tipo de comprobante antes de cobrar.
              </div>
            ) : null}

            <section className="rounded-[18px] bg-[#14201b] p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-[13px] bg-white/10">
                  <ReceiptText className="size-5 text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">Total a cobrar</p>
                  <p className="mt-0.5 text-[11px] text-[#9fb0a8]">
                    El pago quedará vinculado a esta sesión.
                  </p>
                </div>
                <p className="erp-mono text-lg font-bold text-orange-400 sm:text-xl">
                  {formatMoney(totals.total)}
                </p>
              </div>
            </section>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e8e3d7] bg-[#f6f3ec]/95 p-3.5 backdrop-blur lg:bottom-5 lg:left-1/2 lg:right-auto lg:w-[min(960px,calc(100%-48px))] lg:-translate-x-1/2 lg:rounded-[20px] lg:border lg:bg-white/95 lg:p-3 lg:shadow-xl">
        <div className="mx-auto max-w-5xl">
          {step === 1 ? (
            <button
              type="button"
              disabled={!items.length}
              onClick={() => setStep(2)}
              className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-orange-500 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_#e86400] transition active:scale-[.99] disabled:bg-[#d8d4c8] disabled:text-[#a5a396] disabled:shadow-none"
            >
              Siguiente paso
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canCharge}
              onClick={() => setPaymentOpen(true)}
              className="h-[52px] w-full rounded-[16px] bg-orange-500 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_#e86400] transition active:scale-[.99] disabled:bg-[#d8d4c8] disabled:text-[#a5a396] disabled:shadow-none"
            >
              Cobrar {formatMoney(totals.total)}
            </button>
          )}
        </div>
      </div>

      <ProductSelectorModal
        open={productSelectorOpen}
        products={products}
        onClose={() => setProductSelectorOpen(false)}
        onAdd={addProduct}
        itemCount={totals.quantity}
        total={totals.total}
      />

      <CustomerSelectorModal
        open={customerSelectorOpen}
        customers={customers}
        selectedId={customer?.id ?? null}
        onClose={() => setCustomerSelectorOpen(false)}
        onSelect={chooseCustomer}
        onCreate={() => {
          setCustomerSelectorOpen(false);
          setCustomerCreateOpen(true);
        }}
      />

      <CustomerCreateModal
        open={customerCreateOpen}
        onClose={() => setCustomerCreateOpen(false)}
        onCreated={(created) => {
          setCustomers((current) => [created, ...current]);
          setCustomer(created);
        }}
      />

      <PaymentModal
        open={paymentOpen}
        total={totals.total}
        pending={pendingPayment}
        onClose={() => setPaymentOpen(false)}
        onConfirm={charge}
      />

      <SaleCompleteModal
        sale={completedSale ?? null}
        onNewSale={() => {
          resetSale();
          setCompletedSale(null);
        }}
      />
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-[#7b8680]">{label}</span>
      <span className="erp-mono font-bold">{formatMoney(value)}</span>
    </div>
  );
}
