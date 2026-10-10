export const EXPENSES_PER_PAGE = 20;

export const EXPENSE_CATEGORIES = [
  { value: "compras", label: "Compras" },
  { value: "servicios", label: "Servicios" },
  { value: "personal", label: "Personal" },
  { value: "transporte", label: "Transporte" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "otros", label: "Otros" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];
export type ExpenseStatusFilter = "activos" | "anulados" | "todos";

export type Expense = {
  id: string;
  branch_id: string;
  expense_date: string;
  category: ExpenseCategory;
  description: string;
  amount: string | number;
  notes: string | null;
  is_voided: boolean;
  voided_at: string | null;
  created_at: string;
};

export type ExpenseFilters = {
  query: string;
  branchId: string;
  category: ExpenseCategory | "";
  status: ExpenseStatusFilter;
  dateFrom: string;
  dateTo: string;
  page: number;
};

export type ExpenseListData = {
  expenses: Expense[];
  count: number;
  totalAmount: string | number;
  errorMessage: string | null;
};

export function expenseCategoryLabel(category: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
