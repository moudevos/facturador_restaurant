"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  Clock3,
  ExternalLink,
  History,
  LockKeyhole,
  Play,
  Plus,
  ReceiptText,
  Store,
  WalletCards,
} from "lucide-react";

import { Modal } from "@/components/modal";
import { useFeedback } from "@/components/feedback";
import type { Branch } from "@/features/settings/types";
import {
  closeSalesSessionAction,
  openSalesSessionAction,
  registerCashMovementAction,
} from "../server/actions";
import { getSessionAreaAction } from "../server/list-action";
import type {
  CashMovement,
  RecentSale,
  SalesSessionSummary,
} from "../types/sales";
import {
  formatMoney,
  formatSessionDateTime,
  formatSessionTime,
  PAYMENT_LABELS,
  sessionCode,
  sessionDuration,
} from "../utils/format";

type Cashier = {
  user_id: string;
  email?: string | null;
  role?: string;
  branch_id?: string | null;
  active?: boolean;
};

type SessionAreaData = {
  session: SalesSessionSummary | null;
  history: SalesSessionSummary[];
  sales: RecentSale[];
  movements: CashMovement[];
  errorMessage: string | null;
};

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1] as const;

const MOVEMENT_REASONS = {
  in: [
    { value: "change", label: "Cambio / sencillo" },
    { value: "cash_in", label: "Aporte de caja" },
    { value: "other", label: "Otro" },
  ],
  out: [
    { value: "supplies", label: "Compra de insumos" },
    { value: "safe_withdrawal", label: "Retiro a caja fuerte" },
    { value: "supplier_payment", label: "Pago a proveedor" },
    { value: "other", label: "Otro" },
  ],
} as const;

export function SalesAreaManager({
  organizationId,
  branch,
  branches,
  cashiers,
  currentUserId,
  timeZone,
  initialData,
}: {
  organizationId: string;
  branch: Branch;
  branches: Branch[];
  cashiers: Cashier[];
  currentUserId: string;
  timeZone: string;
  initialData: SessionAreaData;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast, confirm, alert } = useFeedback();
  const [tab, setTab] = useState<"session" | "history">("session");
  const [openModal, setOpenModal] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [historyDetail, setHistoryDetail] = useState<SalesSessionSummary | null>(null);

  const query = useQuery({
    queryKey: ["sales-area", organizationId, branch.id],
    queryFn: () => getSessionAreaAction(branch.id),
    initialData,
  });

  const openMutation = useMutation({ mutationFn: openSalesSessionAction });
  const movementMutation = useMutation({ mutationFn: registerCashMovementAction });
  const closeMutation = useMutation({ mutationFn: closeSalesSessionAction });

  const data = query.data;
  const session = data.session;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ["sales-area", organizationId, branch.id],
    });
  }

  async function openSession(input: {
    cashierUserId: string;
    openingCash: number;
    openingNote?: string;
  }) {
    const result = await openMutation.mutateAsync({
      branchId: branch.id,
      ...input,
    });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    await refresh();
    setOpenModal(false);
    toast.success(result.message);
  }

  async function registerMovement(input: {
    movementType: "in" | "out";
    reasonCode: string;
    amount: number;
    description?: string;
  }) {
    if (!session) return;

    const result = await movementMutation.mutateAsync({
      sessionId: session.session_id,
      ...input,
    });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    await refresh();
    setMovementModal(false);
    toast.success(result.message);
  }

  async function closeSession(input: { countedCash: number; closingNote?: string }) {
    if (!session) return;

    const accepted = await confirm({
      title: `Cerrar ${sessionCode(session.session_id)}`,
      description:
        "La sesión quedará cerrada y el POS ya no aceptará nuevas ventas en ella. Esta acción no se puede deshacer.",
      tone: "warning",
      confirmText: "Sí, cerrar sesión",
      cancelText: "Revisar",
    });

    if (!accepted) return;

    const result = await closeMutation.mutateAsync({
      sessionId: session.session_id,
      ...input,
    });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    await refresh();
    setCloseModal(false);
    setTab("history");

    await alert.success({
      title: "Sesión cerrada",
      description: `Esperado ${formatMoney(result.data?.expectedCash)} · Contado ${formatMoney(
        result.data?.countedCash,
      )} · Diferencia ${formatMoney(result.data?.difference)}`,
      confirmText: "Listo",
    });
  }

  function openPos() {
    if (!session) return;
    window.open(
      `/pos/${session.session_id}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <Store className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Local operativo</p>
            <p className="font-semibold text-neutral-900">{branch.code} · {branch.name}</p>
          </div>
        </div>

        {branches.length > 1 ? (
          <select
            value={branch.id}
            onChange={(event) => router.push(`/ventas?local=${event.target.value}`)}
            className="h-10 rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-900"
            aria-label="Cambiar local"
          >
            {branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="inline-flex rounded-xl bg-neutral-100 p-1">
        <button
          type="button"
          onClick={() => setTab("session")}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${
            tab === "session" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
          }`}
        >
          <WalletCards className="size-4" />
          Sesión
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition ${
            tab === "history" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
          }`}
        >
          <History className="size-4" />
          Historial
        </button>
      </div>

      {data.errorMessage ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {data.errorMessage}
        </div>
      ) : null}

      {tab === "session" ? (
        session ? (
          <OpenSessionView
            session={session}
            sales={data.sales}
            movements={data.movements}
            cashiers={cashiers}
            timeZone={timeZone}
            onOpenPos={openPos}
            onMovement={() => setMovementModal(true)}
            onClose={() => setCloseModal(true)}
          />
        ) : (
          <NoSessionView
            onOpen={() => setOpenModal(true)}
            history={data.history}
            timeZone={timeZone}
            onHistory={(item) => setHistoryDetail(item)}
          />
        )
      ) : (
        <SessionHistory
          sessions={data.history}
          timeZone={timeZone}
          onDetail={(item) => setHistoryDetail(item)}
        />
      )}

      <OpenSessionModal
        open={openModal}
        cashiers={cashiers}
        currentUserId={currentUserId}
        pending={openMutation.isPending}
        onClose={() => setOpenModal(false)}
        onSubmit={openSession}
      />

      {session ? (
        <>
          <CashMovementModal
            open={movementModal}
            expectedCash={Number(session.current_expected_cash)}
            pending={movementMutation.isPending}
            onClose={() => setMovementModal(false)}
            onSubmit={registerMovement}
          />
          <CloseSessionModal
            open={closeModal}
            session={session}
            pending={closeMutation.isPending}
            onClose={() => setCloseModal(false)}
            onSubmit={closeSession}
          />
        </>
      ) : null}

      <SessionDetailModal
        session={historyDetail}
        timeZone={timeZone}
        onClose={() => setHistoryDetail(null)}
      />
    </div>
  );
}

function NoSessionView({
  onOpen,
  history,
  timeZone,
  onHistory,
}: {
  onOpen: () => void;
  history: SalesSessionSummary[];
  timeZone: string;
  onHistory: (session: SalesSessionSummary) => void;
}) {
  const last = history[0];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Ventas bloqueadas</p>
        <p className="mt-1 text-blue-800">
          Abre una sesión de caja indicando el cajero y fondo inicial para habilitar el POS.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-orange-50 text-orange-600">
          <LockKeyhole className="size-7" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-neutral-900">No hay sesión abierta</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
          La apertura controla el efectivo inicial, las ventas y el arqueo de cierre.
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
        >
          <Play className="size-4" />
          Abrir sesión
        </button>
      </div>

      {last ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Última sesión cerrada</p>
          <button
            type="button"
            onClick={() => onHistory(last)}
            className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-neutral-100">
              <ReceiptText className="size-5 text-neutral-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-neutral-900">{sessionCode(last.session_id)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {formatSessionDateTime(last.opened_at, timeZone)} · {last.sales_count} ventas
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{formatMoney(last.total_sales)}</p>
              <DifferenceBadge difference={Number(last.cash_difference ?? 0)} />
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OpenSessionView({
  session,
  sales,
  movements,
  cashiers,
  timeZone,
  onOpenPos,
  onMovement,
  onClose,
}: {
  session: SalesSessionSummary;
  sales: RecentSale[];
  movements: CashMovement[];
  cashiers: Cashier[];
  timeZone: string;
  onOpenPos: () => void;
  onMovement: () => void;
  onClose: () => void;
}) {
  const cashier = cashiers.find((item) => item.user_id === session.cashier_user_id);
  const average = session.sales_count
    ? Number(session.total_sales) / session.sales_count
    : 0;

  const paymentRows = [
    ["cash", Number(session.cash_sales)],
    ["yape", Number(session.yape_sales)],
    ["plin", Number(session.plin_sales)],
    ["card", Number(session.card_sales)],
    ["transfer", Number(session.transfer_sales)],
  ].filter(([, amount]) => Number(amount) > 0) as Array<[keyof typeof PAYMENT_LABELS, number]>;

  const recent = [
    ...sales.map((sale) => ({
      key: `sale-${sale.id}`,
      kind: "sale" as const,
      title: `${sale.series}-${String(sale.correlative).padStart(8, "0")}`,
      subtitle: `${sale.customer_name || "Cliente varios"} · ${sale.payment_method ? PAYMENT_LABELS[sale.payment_method] : "Pago"}`,
      amount: Number(sale.total_amount),
      createdAt: sale.created_at,
    })),
    ...movements.map((movement) => ({
      key: `movement-${movement.id}`,
      kind: movement.movement_type,
      title: movementLabel(movement.reason_code),
      subtitle: movement.description || (movement.movement_type === "in" ? "Ingreso de caja" : "Salida de caja"),
      amount: Number(movement.amount),
      createdAt: movement.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-neutral-900">{sessionCode(session.session_id)}</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                ABIERTA
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {cashier?.email || "Cajero asignado"} · desde {formatSessionTime(session.opened_at, timeZone)}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPos}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
          >
            <ExternalLink className="size-4" />
            Ir a vender
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Fondo inicial" value={formatMoney(session.opening_cash)} />
          <MiniStat label="Duración" value={sessionDuration(session.opened_at)} />
          <MiniStat label="Ventas" value={String(session.sales_count)} detail={`Ticket prom. ${formatMoney(average)}`} />
          <MiniStat
            label="Efectivo esperado"
            value={formatMoney(session.current_expected_cash)}
            highlighted
          />
        </div>

        {session.opening_note ? (
          <p className="mt-4 rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            Nota de apertura: {session.opening_note}
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onMovement}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
        >
          <Plus className="size-4" />
          Movimiento de caja
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
        >
          <LockKeyhole className="size-4" />
          Cerrar sesión
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Ventas por método</h3>
            <span className="text-sm font-semibold tabular-nums">{formatMoney(session.total_sales)}</span>
          </div>
          {paymentRows.length ? (
            <div className="space-y-3">
              {paymentRows.map(([method, amount]) => {
                const pct = Number(session.total_sales)
                  ? Math.round((amount / Number(session.total_sales)) * 100)
                  : 0;
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-neutral-700">{PAYMENT_LABELS[method]}</span>
                      <div className="text-right">
                        <span className="font-semibold tabular-nums">{formatMoney(amount)}</span>
                        <span className="ml-2 text-xs text-neutral-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.max(2, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Aún no hay ventas en esta sesión.</p>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">Actividad reciente</h3>
            <Clock3 className="size-4 text-neutral-400" />
          </div>
          {recent.length ? (
            <div className="divide-y divide-neutral-100">
              {recent.map((item) => (
                <div key={item.key} className="flex items-center gap-3 py-3">
                  <div
                    className={`flex size-9 items-center justify-center rounded-xl ${
                      item.kind === "in"
                        ? "bg-emerald-50 text-emerald-600"
                        : item.kind === "out"
                          ? "bg-red-50 text-red-600"
                          : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {item.kind === "in" ? <ArrowDown className="size-4" /> : item.kind === "out" ? <ArrowUp className="size-4" /> : <ReceiptText className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{item.title}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {formatSessionTime(item.createdAt, timeZone)} · {item.subtitle}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold tabular-nums ${item.kind === "out" ? "text-red-600" : item.kind === "in" ? "text-emerald-600" : "text-neutral-900"}`}>
                    {item.kind === "out" ? "−" : item.kind === "in" ? "+" : ""}
                    {formatMoney(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Todavía no hay actividad registrada.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function SessionHistory({
  sessions,
  timeZone,
  onDetail,
}: {
  sessions: SalesSessionSummary[];
  timeZone: string;
  onDetail: (session: SalesSessionSummary) => void;
}) {
  const sold = sessions.reduce((sum, session) => sum + Number(session.total_sales), 0);
  const difference = sessions.reduce((sum, session) => sum + Number(session.cash_difference ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="Vendido" value={formatMoney(sold)} highlighted />
        <MiniStat label="Sesiones" value={String(sessions.length)} />
        <MiniStat label="Diferencia" value={formatMoney(difference)} />
      </div>

      {sessions.length ? (
        <div className="space-y-3">
          {sessions.map((session) => (
            <button
              key={session.session_id}
              type="button"
              onClick={() => onDetail(session)}
              className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-neutral-300"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-neutral-100">
                <ReceiptText className="size-5 text-neutral-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-neutral-900">{sessionCode(session.session_id)}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatSessionDateTime(session.opened_at, timeZone)} · {sessionDuration(session.opened_at, session.closed_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{formatMoney(session.total_sales)}</p>
                <DifferenceBadge difference={Number(session.cash_difference ?? 0)} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center text-sm text-neutral-500">
          Aún no hay sesiones cerradas.
        </div>
      )}
    </div>
  );
}

function OpenSessionModal({
  open,
  cashiers,
  currentUserId,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  cashiers: Cashier[];
  currentUserId: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { cashierUserId: string; openingCash: number; openingNote?: string }) => Promise<void>;
}) {
  const [cashier, setCashier] = useState(currentUserId);
  const [cash, setCash] = useState("0");
  const [note, setNote] = useState("");

  const valid = cash !== "" && Number(cash) >= 0 && Boolean(cashier);

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Abrir sesión"
      description="Selecciona el cajero responsable y registra el fondo inicial de efectivo."
      icon={WalletCards}
      size="md"
    >
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Cajero responsable</p>
          <div className="mt-2 space-y-2">
            {cashiers.map((item) => (
              <button
                key={item.user_id}
                type="button"
                onClick={() => setCashier(item.user_id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                  cashier === item.user_id ? "border-orange-400 bg-orange-50" : "border-neutral-200"
                }`}
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                  {(item.email || "C").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.email || "Cajero actual"}</p>
                  <p className="text-xs text-neutral-500">{item.role === "owner" ? "Propietario" : "Cajero"}</p>
                </div>
                <span className={`size-4 rounded-full border-4 ${cashier === item.user_id ? "border-orange-500" : "border-neutral-200"}`} />
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium text-neutral-700">
          Fondo inicial de caja
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400">S/</span>
            <input
              value={cash}
              onChange={(event) => setCash(event.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="h-11 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-lg font-semibold tabular-nums outline-none focus:border-orange-400"
            />
          </div>
        </label>

        <div className="flex flex-wrap gap-2">
          {[0, 100, 200, 300, 500].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCash(String(value))}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              S/ {value}
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium text-neutral-700">
          Nota de apertura
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Opcional"
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-orange-400"
          />
        </label>

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => void onSubmit({ cashierUserId: cashier, openingCash: Number(cash), openingNote: note })}
            className="h-11 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Abriendo..." : `Abrir con ${formatMoney(Number(cash))}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CashMovementModal({
  open,
  expectedCash,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  expectedCash: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: {
    movementType: "in" | "out";
    reasonCode: string;
    amount: number;
    description?: string;
  }) => Promise<void>;
}) {
  const [type, setType] = useState<"in" | "out">("out");
  const [reason, setReason] = useState<string>("supplies");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const reasons = MOVEMENT_REASONS[type];
  const over = type === "out" && Number(amount) > expectedCash;
  const valid = Number(amount) > 0 && Boolean(reason) && !over;

  function changeType(next: "in" | "out") {
    setType(next);
    setReason(next === "in" ? "change" : "supplies");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Movimiento de caja"
      description={`Efectivo esperado actual: ${formatMoney(expectedCash)}`}
      icon={Banknote}
      size="md"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => changeType("in")}
            className={`h-10 rounded-lg text-sm font-semibold ${type === "in" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-500"}`}
          >
            ↓ Ingreso
          </button>
          <button
            type="button"
            onClick={() => changeType("out")}
            className={`h-10 rounded-lg text-sm font-semibold ${type === "out" ? "bg-white text-red-700 shadow-sm" : "text-neutral-500"}`}
          >
            ↑ Salida
          </button>
        </div>

        <label className="block text-sm font-medium">
          Monto
          <div className="relative mt-1.5">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">S/</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="h-12 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-xl font-semibold tabular-nums outline-none focus:border-neutral-900"
              placeholder="0.00"
            />
          </div>
        </label>

        {over ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
            La salida supera el efectivo esperado de {formatMoney(expectedCash)}.
          </p>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Motivo</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reasons.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setReason(item.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  reason === item.value ? "border-orange-400 bg-orange-50 text-orange-700" : "border-neutral-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm font-medium">
          Detalle
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            placeholder="Opcional"
            className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none"
          />
        </label>

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => void onSubmit({ movementType: type, reasonCode: reason, amount: Number(amount), description })}
            className={`h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-50 ${
              type === "out" ? "bg-red-600" : "bg-emerald-600"
            }`}
          >
            {pending ? "Registrando..." : `Registrar ${type === "out" ? "salida" : "ingreso"}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CloseSessionModal({
  open,
  session,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  session: SalesSessionSummary;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { countedCash: number; closingNote?: string }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"den" | "total">("den");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");

  const counted = useMemo(
    () =>
      mode === "total"
        ? Number(total || 0)
        : DENOMINATIONS.reduce((sum, value) => sum + value * (counts[String(value)] ?? 0), 0),
    [counts, mode, total],
  );
  const expected = Number(session.current_expected_cash);
  const difference = Math.round((counted - expected) * 100) / 100;
  const requiresNote = counted > 0 && Math.abs(difference) >= 0.01;
  const valid = counted >= 0 && (!requiresNote || note.trim().length >= 3);

  function changeCount(value: number, delta: number) {
    const key = String(value);
    setCounts((current) => ({
      ...current,
      [key]: Math.max(0, (current[key] ?? 0) + delta),
    }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!pending}
      title="Cerrar sesión"
      description={`${sessionCode(session.session_id)} · ${session.sales_count} ventas`}
      icon={LockKeyhole}
      size="lg"
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-neutral-50 p-4">
          <CashLine label="Fondo inicial" value={Number(session.opening_cash)} />
          <CashLine label="+ Ventas en efectivo" value={Number(session.cash_sales)} />
          <CashLine label="+ Ingresos de caja" value={Number(session.cash_in)} />
          <CashLine label="− Salidas de caja" value={Number(session.cash_out)} />
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-neutral-300 pt-3">
            <span className="font-semibold text-neutral-900">Efectivo esperado</span>
            <span className="text-lg font-semibold tabular-nums text-emerald-700">{formatMoney(expected)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-xl bg-neutral-100 p-1">
          <button type="button" onClick={() => setMode("den")} className={`h-10 rounded-lg text-sm font-semibold ${mode === "den" ? "bg-white shadow-sm" : "text-neutral-500"}`}>
            Por denominación
          </button>
          <button type="button" onClick={() => setMode("total")} className={`h-10 rounded-lg text-sm font-semibold ${mode === "total" ? "bg-white shadow-sm" : "text-neutral-500"}`}>
            Monto total
          </button>
        </div>

        {mode === "den" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {DENOMINATIONS.map((value) => (
              <div key={value} className="flex items-center justify-between rounded-xl border border-neutral-200 p-2 pl-3">
                <div>
                  <p className="font-semibold tabular-nums">S/ {value >= 1 ? value : value.toFixed(2)}</p>
                  <p className="text-xs text-neutral-400">{value >= 10 ? "Billete" : "Moneda"}</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-neutral-50 p-1">
                  <button type="button" onClick={() => changeCount(value, -1)} className="size-8 rounded-md bg-white shadow-sm">−</button>
                  <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{counts[String(value)] ?? 0}</span>
                  <button type="button" onClick={() => changeCount(value, 1)} className="size-8 rounded-md bg-white shadow-sm">+</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium">
              Efectivo contado
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">S/</span>
                <input
                  value={total}
                  onChange={(event) => setTotal(event.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  className="h-12 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-xl font-semibold tabular-nums outline-none"
                />
              </div>
            </label>
            <button type="button" onClick={() => setTotal(String(expected))} className="mt-2 text-sm font-semibold text-orange-600 underline">
              Rellenar con el monto esperado
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="font-semibold text-neutral-700">Total contado</span>
          <span className="text-xl font-semibold tabular-nums">{formatMoney(counted)}</span>
        </div>

        <DifferencePanel difference={difference} counted={counted} />

        <label className="block text-sm font-medium">
          Observaciones {requiresNote ? <span className="text-red-600">· obligatorio por diferencia</span> : null}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Explica cualquier diferencia o incidencia."
            className="mt-1.5 w-full rounded-xl border border-neutral-200 p-3 text-sm outline-none"
          />
        </label>

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className="h-11 rounded-xl border border-neutral-200 px-5 text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valid || pending}
            onClick={() => void onSubmit({ countedCash: counted, closingNote: note })}
            className="h-11 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Cerrando..." : "Revisar y cerrar sesión"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SessionDetailModal({
  session,
  timeZone,
  onClose,
}: {
  session: SalesSessionSummary | null;
  timeZone: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(session)}
      onClose={onClose}
      title={session ? `Sesión ${sessionCode(session.session_id)}` : "Sesión"}
      description={session ? formatSessionDateTime(session.opened_at, timeZone) : undefined}
      icon={ReceiptText}
      size="md"
    >
      {session ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-neutral-200 p-4">
            <DetailRow label="Apertura" value={formatSessionDateTime(session.opened_at, timeZone)} />
            <DetailRow label="Cierre" value={session.closed_at ? formatSessionDateTime(session.closed_at, timeZone) : "—"} />
            <DetailRow label="Duración" value={sessionDuration(session.opened_at, session.closed_at)} />
            <DetailRow label="Ventas" value={String(session.sales_count)} />
            <DetailRow label="Total vendido" value={formatMoney(session.total_sales)} />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Ventas por método</p>
            <div className="rounded-xl border border-neutral-200 p-4">
              <DetailRow label="Efectivo" value={formatMoney(session.cash_sales)} />
              <DetailRow label="Yape" value={formatMoney(session.yape_sales)} />
              <DetailRow label="Plin" value={formatMoney(session.plin_sales)} />
              <DetailRow label="Tarjeta" value={formatMoney(session.card_sales)} />
              <DetailRow label="Transferencia" value={formatMoney(session.transfer_sales)} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Arqueo</p>
            <div className="rounded-xl border border-neutral-200 p-4">
              <DetailRow label="Fondo inicial" value={formatMoney(session.opening_cash)} />
              <DetailRow label="Efectivo esperado" value={formatMoney(session.closed_expected_cash)} />
              <DetailRow label="Efectivo contado" value={formatMoney(session.counted_cash)} />
              <DetailRow label="Diferencia" value={formatMoney(session.cash_difference)} />
            </div>
          </div>

          {session.closing_note ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {session.closing_note}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function MiniStat({
  label,
  value,
  detail,
  highlighted = false,
}: {
  label: string;
  value: string;
  detail?: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlighted ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${highlighted ? "text-neutral-400" : "text-neutral-400"}`}>{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${highlighted ? "text-orange-400" : "text-neutral-900"}`}>{value}</p>
      {detail ? <p className={`mt-1 text-xs ${highlighted ? "text-neutral-400" : "text-neutral-500"}`}>{detail}</p> : null}
    </div>
  );
}

function CashLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium tabular-nums text-neutral-900">{formatMoney(value)}</span>
    </div>
  );
}

function DifferencePanel({ difference, counted }: { difference: number; counted: number }) {
  if (counted === 0) {
    return <div className="rounded-xl bg-neutral-100 p-3 text-sm font-medium text-neutral-500">Ingresa el conteo para ver la diferencia.</div>;
  }
  if (Math.abs(difference) < 0.01) {
    return <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">La caja cuadra · {formatMoney(0)}</div>;
  }
  if (difference > 0) {
    return <div className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700">Sobrante · +{formatMoney(difference)}</div>;
  }
  return <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Faltante · −{formatMoney(Math.abs(difference))}</div>;
}

function DifferenceBadge({ difference }: { difference: number }) {
  if (Math.abs(difference) < 0.01) {
    return <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Cuadra</span>;
  }
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${difference > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"}`}>
      {difference > 0 ? "Sobra" : "Falta"} {formatMoney(Math.abs(difference))}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function movementLabel(reason: CashMovement["reason_code"]) {
  const labels: Record<CashMovement["reason_code"], string> = {
    change: "Cambio / sencillo",
    cash_in: "Aporte de caja",
    safe_withdrawal: "Retiro a caja fuerte",
    supplies: "Compra de insumos",
    supplier_payment: "Pago a proveedor",
    other: "Otro movimiento",
  };
  return labels[reason];
}
