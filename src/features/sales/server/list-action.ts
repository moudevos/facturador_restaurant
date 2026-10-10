"use server";

import { getSalesContext } from "./context";
import {
  getOpenSession,
  listRecentSessionSales,
  listSessionHistory,
  listSessionMovements,
} from "./sales";

export async function getSessionAreaAction(branchId: string) {
  const context = await getSalesContext();
  if (!context) {
    return {
      session: null,
      history: [],
      sales: [],
      movements: [],
      errorMessage: "No pudimos cargar el área de venta.",
    };
  }

  const open = await getOpenSession(branchId);
  const history = await listSessionHistory(branchId);

  if (!open.session) {
    return {
      session: null,
      history: history.sessions,
      sales: [],
      movements: [],
      errorMessage: open.error || history.error ? "No pudimos cargar las sesiones. Verifica SQL 010." : null,
    };
  }

  const [sales, movements] = await Promise.all([
    listRecentSessionSales(open.session.session_id),
    listSessionMovements(open.session.session_id),
  ]);

  return {
    session: open.session,
    history: history.sessions,
    sales: sales.sales,
    movements: movements.movements,
    errorMessage:
      open.error || history.error || sales.error || movements.error
        ? "No pudimos cargar todos los datos de la sesión."
        : null,
  };
}
