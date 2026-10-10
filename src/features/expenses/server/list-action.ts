"use server";

import { getExpenseContext, listExpenses } from "./expenses";
import type { ExpenseFilters, ExpenseStatusFilter } from "../types/expense";
import { EXPENSE_CATEGORIES } from "../types/expense";

const allowedCategories = new Set<string>(EXPENSE_CATEGORIES.map((item) => item.value));

function normalizeFilters(filters: ExpenseFilters): ExpenseFilters {
  const status: ExpenseStatusFilter =
    filters.status === "anulados" || filters.status === "todos" ? filters.status : "activos";
  const category = allowedCategories.has(filters.category) ? filters.category : "";

  return {
    query: filters.query.trim().slice(0, 120),
    branchId: /^[0-9a-f-]{36}$/i.test(filters.branchId) ? filters.branchId : "",
    category,
    status,
    dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom) ? filters.dateFrom : "",
    dateTo: /^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo) ? filters.dateTo : "",
    page: Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1,
  };
}

export async function listExpensesAction(filters: ExpenseFilters) {
  const context = await getExpenseContext();
  if (!context) {
    return {
      expenses: [],
      count: 0,
      totalAmount: 0,
      errorMessage: "No pudimos cargar los egresos.",
    };
  }

  const normalized = normalizeFilters(filters);

  if (context.role === "cashier" && context.branchId) {
    normalized.branchId = context.branchId;
  }

  const result = await listExpenses({ context, filters: normalized });

  return {
    expenses: result.expenses,
    count: result.count,
    totalAmount: result.totalAmount,
    errorMessage: result.error ? "No pudimos cargar los egresos. Verifica que el SQL 009 esté aplicado." : null,
  };
}
