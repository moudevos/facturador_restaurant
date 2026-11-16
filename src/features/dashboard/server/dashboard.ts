// Dashboard consolidado. Mantener una sola implementación para evitar conflictos de merge.
import { createClient } from "@/lib/supabase/server";
import { getBusinessDateISO } from "@/lib/date-time";
import type { SalesContext } from "@/features/sales/server/context";
import type { RecentSale, SalesSessionSummary } from "@/features/sales/types/sales";

export type DashboardDay = {
  date: string;
  amount: number;
  count: number;
};

export type DashboardData = {
  businessDate: string;
  todayCollected: number;
  monthCollected: number;
  todayInvoiced: number;
  monthExpenses: number;
  monthSimpleResult: number;
  todayDocuments: number;
  last7Days: DashboardDay[];
  openSessions: SalesSessionSummary[];
  recentSales: Array<RecentSale & { internalTicket?: string }>;
  recentExpenses: Array<{
    id: string;
    expense_date: string;
    description: string;
    amount: string | number;
    category: string;
  }>;
  errorMessage: string | null;
};

const DASHBOARD_QUERY_TIMEOUT_MS = 5_000;

function dateRange(end: string, days: number) {
  const result: string[] = [];
  const current = new Date(`${end}T12:00:00Z`);
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(current);
    date.setUTCDate(current.getUTCDate() - index);
    result.push(date.toISOString().slice(0, 10));
  }
  return result;
}

export async function getDashboardData(context: SalesContext): Promise<DashboardData> {
  const supabase = await createClient();
  const businessDate = getBusinessDateISO(new Date(), context.timeZone);
  const monthStart = `${businessDate.slice(0, 8)}01`;
  const days = dateRange(businessDate, 7);

  const newSignal = () => AbortSignal.timeout(DASHBOARD_QUERY_TIMEOUT_MS);

  const [collectionsResult, financialResult, sessionResult, salesResult, expensesResult, resultResult, internalSalesResult] =
    await Promise.all([
      supabase
        .from("v_daily_collections")
        .select("business_date, collected_amount, sales_count")
        .gte("business_date", monthStart)
        .lte("business_date", businessDate)
        .abortSignal(newSignal()),
      supabase
        .from("v_daily_financial_summary")
        .select("business_date, document_count, invoiced_amount, expense_amount, simple_result")
        .gte("business_date", monthStart)
        .lte("business_date", businessDate)
        .abortSignal(newSignal()),
      supabase
        .from("v_sales_session_summary")
        .select("*")
        .eq("status", "open")
        .order("opened_at")
        .abortSignal(newSignal()),
      supabase
        .from("sales")
        .select("id, series, correlative, customer_name, total_amount, created_at, sale_payments(payment_method)")
        .eq("commercial_status", "completed")
        .order("created_at", { ascending: false })
        .limit(6)
        .abortSignal(newSignal()),
      supabase
        .from("expenses")
        .select("id, expense_date, description, amount, category")
        .eq("is_voided", false)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6)
        .abortSignal(newSignal()),
      supabase
        .from("v_restaurant_daily_result")
        .select("business_date,income_amount,expense_amount,result_amount")
        .eq("organization_id",context.organizationId)
        .gte("business_date",monthStart)
        .lte("business_date",businessDate)
        .abortSignal(newSignal()),
      supabase
        .from("restaurant_orders")
        .select("id,total_amount,created_at")
        .eq("organization_id",context.organizationId)
        .order("created_at",{ascending:false})
        .limit(6)
        .abortSignal(newSignal()),
    ]);

  const collections = collectionsResult.data ?? [];
  const financial = financialResult.data ?? [];
  const resultRows = resultResult.data ?? [];

  const todayCollected = resultRows
    .filter((row) => row.business_date === businessDate)
    .reduce((sum, row) => sum + Number(row.income_amount), 0);

  const monthCollected = resultRows.reduce(
    (sum, row) => sum + Number(row.income_amount), 0,
  );

  const todayRows = financial.filter((row) => row.business_date === businessDate);
  const todayInvoiced = todayRows.reduce(
    (sum, row) => sum + Number(row.invoiced_amount),
    0,
  );
  const todayDocuments = todayRows.reduce(
    (sum, row) => sum + Number(row.document_count),
    0,
  );

  const monthExpenses = resultRows.reduce(
    (sum, row) => sum + Number(row.expense_amount), 0,
  );
  const monthSimpleResult = resultRows.reduce(
    (sum, row) => sum + Number(row.result_amount), 0,
  );

  const last7Days = days.map((date) => {
    const rows = resultRows.filter((row) => row.business_date === date);
    const countRows = collections.filter((row) => row.business_date === date);
    return {
      date,
      amount: rows.reduce((sum, row) => sum + Number(row.income_amount), 0),
      count: countRows.reduce((sum, row) => sum + Number(row.sales_count), 0),
    };
  });

  const legacySales: RecentSale[] = (salesResult.data ?? []).map((row) => {
    const payments = Array.isArray(row.sale_payments) ? row.sale_payments : [];
    const first = payments[0] as { payment_method?: RecentSale["payment_method"] } | undefined;
    return {
      id: row.id,
      series: row.series,
      correlative: row.correlative,
      customer_name: row.customer_name,
      total_amount: row.total_amount,
      created_at: row.created_at,
      payment_method: first?.payment_method ?? null,
    };
  });

  const internalSales: Array<RecentSale & { internalTicket: string }> =
    (internalSalesResult.data ?? []).map((row) => ({
      id: row.id,
      series: "INT",
      correlative: 0,
      customer_name: "Venta interna",
      total_amount: row.total_amount,
      created_at: row.created_at,
      payment_method: null,
      internalTicket: row.id.slice(0, 8).toUpperCase(),
    }));
  const recentSales = [...legacySales, ...internalSales]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  const hasError = [
    resultResult.error,
    internalSalesResult.error,
    collectionsResult.error,
    financialResult.error,
    sessionResult.error,
    salesResult.error,
    expensesResult.error,
  ].some(Boolean);

  return {
    businessDate,
    todayCollected,
    monthCollected,
    todayInvoiced,
    monthExpenses,
    monthSimpleResult,
    todayDocuments,
    last7Days,
    openSessions: (sessionResult.data ?? []) as SalesSessionSummary[],
    recentSales,
    recentExpenses: expensesResult.data ?? [],
    errorMessage: hasError
      ? "Algunos indicadores tardaron demasiado o no pudieron cargarse. La navegación seguirá disponible; revisa la conexión o las vistas SQL."
      : null,
  };
}
