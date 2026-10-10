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
  recentSales: RecentSale[];
  recentExpenses: Array<{
    id: string;
    expense_date: string;
    description: string;
    amount: string | number;
    category: string;
  }>;
  errorMessage: string | null;
};

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
  const sevenStart = days[0];

  const [collectionsResult, financialResult, sessionResult, salesResult, expensesResult] =
    await Promise.all([
      supabase
        .from("v_daily_collections")
        .select("business_date, collected_amount, sales_count")
        .gte("business_date", monthStart)
        .lte("business_date", businessDate),
      supabase
        .from("v_daily_financial_summary")
        .select("business_date, document_count, invoiced_amount, expense_amount, simple_result")
        .gte("business_date", monthStart)
        .lte("business_date", businessDate),
      supabase
        .from("v_sales_session_summary")
        .select("*")
        .eq("status", "open")
        .order("opened_at"),
      supabase
        .from("sales")
        .select("id, series, correlative, customer_name, total_amount, created_at, sale_payments(payment_method)")
        .neq("status", "voided")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("expenses")
        .select("id, expense_date, description, amount, category")
        .eq("is_voided", false)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const collections = collectionsResult.data ?? [];
  const financial = financialResult.data ?? [];

  const todayCollected = collections
    .filter((row) => row.business_date === businessDate)
    .reduce((sum, row) => sum + Number(row.collected_amount), 0);

  const monthCollected = collections.reduce(
    (sum, row) => sum + Number(row.collected_amount),
    0,
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

  const monthExpenses = financial.reduce(
    (sum, row) => sum + Number(row.expense_amount),
    0,
  );
  const monthSimpleResult = financial.reduce(
    (sum, row) => sum + Number(row.simple_result),
    0,
  );

  const last7Days = days.map((date) => {
    const rows = collections.filter(
      (row) => row.business_date === date && row.business_date >= sevenStart,
    );
    return {
      date,
      amount: rows.reduce((sum, row) => sum + Number(row.collected_amount), 0),
      count: rows.reduce((sum, row) => sum + Number(row.sales_count), 0),
    };
  });

  const recentSales: RecentSale[] = (salesResult.data ?? []).map((row) => {
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

  const hasError = [
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
      ? "Algunos indicadores no pudieron cargarse. Verifica que los SQL hasta 010 estén aplicados."
      : null,
  };
}
