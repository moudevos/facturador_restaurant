import { redirect } from "next/navigation";

import { SalesAreaManager } from "@/features/sales/components/sales-area-manager";
import {
  getSalesContext,
  listAccessibleBranches,
} from "@/features/sales/server/context";
import {
  getOpenSession,
  listCashiers,
  listRecentSessionSales,
  listSessionHistory,
  listSessionMovements,
} from "@/features/sales/server/sales";

function valueOf(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");

  const branches = await listAccessibleBranches(context);
  if (!branches.length) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Área de venta</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No hay un local activo disponible para abrir una sesión.
        </div>
      </section>
    );
  }

  const params = await searchParams;
  const requested = valueOf(params.local);
  const branch =
    branches.find((item) => item.id === requested) ??
    branches.find((item) => item.id === context.memberBranchId) ??
    branches[0];

  const [open, history, cashiers] = await Promise.all([
    getOpenSession(branch.id),
    listSessionHistory(branch.id),
    listCashiers(context, branch.id),
  ]);

  const [sales, movements] = open.session
    ? await Promise.all([
        listRecentSessionSales(open.session.session_id),
        listSessionMovements(open.session.session_id),
      ])
    : [{ sales: [], error: null }, { movements: [], error: null }];

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-orange-600">Operación</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">Área de venta</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Abre, controla y cierra la sesión de caja. El POS funciona en una pestaña independiente.
        </p>
      </header>

      <SalesAreaManager
        organizationId={context.organizationId}
        branch={branch}
        branches={branches}
        cashiers={cashiers}
        currentUserId={context.userId}
        timeZone={context.timeZone}
        initialData={{
          session: open.session,
          history: history.sessions,
          sales: sales.sales,
          movements: movements.movements,
          errorMessage:
            open.error || history.error || sales.error || movements.error
              ? "No pudimos cargar todos los datos. Verifica que SQL 010 esté aplicado."
              : null,
        }}
      />
    </section>
  );
}
