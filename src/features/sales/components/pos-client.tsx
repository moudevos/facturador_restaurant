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
  const { toast, alert, withLoading } = useFeedback();
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
          title: "Registrando venta",
          message: "Validando productos, correlativo y pago...",
        },
      );

      if (!result.success || !result.data) {
        toast.error(result.message);
        return;
      }

      setPaymentOpen(false);

      const number = `${result.data.series}-${String(result.data.correlative).padStart(8, "0")}`;
      const changeText =
        result.data.changeAmount > 0
          ? ` Vuelto: ${formatMoney(result.data.changeAmount)}.`
          : "";

      await alert.success({
        title: "Venta completada",
        description:
          `${number} · ${formatMoney(result.data.totalAmount)}.${changeText} La venta quedó registrada; la emisión electrónica con Intifact se conectará en la siguiente fase fiscal.`,
        confirmText: "Nueva venta",
      });

      resetSale();
    } finally {
      setPendingPayment(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#f6f3ec] text-neutral-900">
      <header className="sticky top-0 z-20 bg-[#14201b] text-white shadow-sm">
        <div className="mx-auto max-w-3xl px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{tradeName}</p>
              <p className="truncate text-xs text-emerald-100/70">
                {branchName} · {sessionCode(sessionId)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80"
            >
              Cerrar POS
            </button>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Total a cobrar
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-orange-400">
                {formatMoney(totals.total)}
              </p>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">
              {totals.quantity} {totals.quantity === 1 ? "unidad" : "unidades"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`h-10 rounded-lg text-sm font-semibold ${
              step === 1 ? "bg-[#14201b] text-white" : "text-neutral-500"
            }`}
          >
            1 · Carrito
          </button>
          <button
            type="button"
            disabled={!items.length}
            onClick={() => setStep(2)}
            className={`h-10 rounded-lg text-sm font-semibold disabled:opacity-40 ${
              step === 2 ? "bg-[#14201b] text-white" : "text-neutral-500"
            }`}
          >
            2 · Cierre
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setProductSelectorOpen(true)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
            >
              <PackagePlus className="size-5" />
              Agregar productos
            </button>

            <section className="rounded-2xl border border-[#e8e3d7] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">Carrito</h2>
                <span className="text-xs font-semibold text-neutral-400">
                  {items.length} {items.length === 1 ? "producto" : "productos"}
                </span>
              </div>

              {items.length ? (
                <div className="divide-y divide-neutral-100">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.product.name}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {formatMoney(item.product.price)} c/u
                        </p>
                      </div>
                      <p className="w-20 text-right text-sm font-bold tabular-nums">
                        {formatMoney(Number(item.product.price) * item.quantity)}
                      </p>
                      <div className="flex items-center gap-1 rounded-xl bg-[#f6f3ec] p-1">
                        {item.quantity === 1 ? (
                          <button
                            type="button"
                            onClick={() => remove(item.product.id)}
                            className="flex size-8 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => decrease(item.product.id)}
                            className="flex size-8 items-center justify-center rounded-lg bg-white shadow-sm"
                          >
                            <Minus className="size-3.5" />
                          </button>
                        )}
                        <span className="min-w-7 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => increase(item.product.id)}
                          className="flex size-8 items-center justify-center rounded-lg bg-white shadow-sm"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                    <ShoppingCart className="size-6" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">El carrito está vacío</p>
                  <p className="mt-1 text-xs text-neutral-500">Agrega productos para comenzar la venta.</p>
                </div>
              )}
            </section>

            {items.length ? (
              <section className="rounded-2xl border border-[#e8e3d7] bg-white p-4">
                <SummaryLine label="Subtotal" value={totals.subtotal} />
                <SummaryLine label="IGV" value={totals.igv} />
                <div className="mt-3 flex items-center justify-between border-t border-dashed border-neutral-200 pt-3">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold tabular-nums">{formatMoney(totals.total)}</span>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-500"
            >
              <ArrowLeft className="size-4" />
              Volver al pedido
            </button>

            <section className="rounded-2xl border border-[#e8e3d7] bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Pedido</p>
                  <p className="mt-1 text-sm font-semibold">{totals.quantity} unidades</p>
                </div>
                <p className="text-xl font-bold tabular-nums">{formatMoney(totals.total)}</p>
              </div>
            </section>

            <button
              type="button"
              onClick={() => setCustomerSelectorOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#e8e3d7] bg-white p-4 text-left"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <UserRound className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Cliente</p>
                <p className="mt-1 truncate text-sm font-semibold">{customer?.name || "Cliente varios"}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {customer
                    ? `${customer.document_type === "6" ? "RUC" : "DNI"} · ${customer.document_number}`
                    : "Opcional · sin documento"}
                </p>
              </div>
              <ChevronRight className="size-5 text-neutral-300" />
            </button>

            <section className="rounded-2xl border border-[#e8e3d7] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Comprobante</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDocumentType("03")}
                  className={`h-11 rounded-xl border text-sm font-semibold ${
                    documentType === "03" ? "border-orange-400 bg-orange-50 text-orange-800" : "border-neutral-200"
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
                  className={`h-11 rounded-xl border text-sm font-semibold ${
                    documentType === "01" ? "border-orange-400 bg-orange-50 text-orange-800" : "border-neutral-200"
                  } ${!canInvoice ? "opacity-50" : ""}`}
                >
                  Factura
                </button>
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                Serie: <span className="font-semibold text-neutral-700">{selectedSeries || "Sin serie activa"}</span>
              </p>
            </section>

            {!selectedSeries ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Configura una serie activa para este tipo de comprobante antes de cobrar.
              </div>
            ) : null}

            <section className="rounded-2xl border border-[#e8e3d7] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-neutral-100">
                  <ReceiptText className="size-5 text-neutral-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Total a cobrar</p>
                  <p className="text-xs text-neutral-500">
                    El pago quedará vinculado a esta sesión de caja.
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums">{formatMoney(totals.total)}</p>
              </div>
            </section>
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e8e3d7] bg-[#f6f3ec]/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          {step === 1 ? (
            <button
              type="button"
              disabled={!items.length}
              onClick={() => setStep(2)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#14201b] text-sm font-bold text-white disabled:opacity-40"
            >
              Siguiente paso
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canCharge}
              onClick={() => setPaymentOpen(true)}
              className="h-12 w-full rounded-2xl bg-orange-500 text-sm font-bold text-white disabled:opacity-40"
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
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold tabular-nums">{formatMoney(value)}</span>
    </div>
  );
}
