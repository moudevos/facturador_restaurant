"use server";

import { z } from "zod";

import { getSalesContext } from "@/features/sales/server/context";
import { listDocuments } from "./documents";
import type { DocumentFilters } from "../types/document";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function listDocumentsAction(input: DocumentFilters) {
  const context = await getSalesContext();
  if (!context) {
    return {
      documents: [],
      count: 0,
      summary: {
        recordCount: 0,
        acceptedCount: 0,
        pendingCount: 0,
        issueCount: 0,
        acceptedAmount: 0,
      },
      errorMessage: "Tu sesión de usuario no es válida.",
    };
  }

  const parsed = z.object({
    q: z.string().max(120),
    dateFrom: date,
    dateTo: date,
    branchId: z.string().uuid().or(z.literal("")),
    documentType: z.enum(["all", "01", "03"]),
    status: z.enum([
      "all",
      "accepted",
      "pending",
      "rejected",
      "queue_failed",
      "error",
      "voided",
    ]),
    page: z.number().int().min(1).max(100000),
  }).safeParse(input);

  if (!parsed.success) {
    return {
      documents: [],
      count: 0,
      summary: {
        recordCount: 0,
        acceptedCount: 0,
        pendingCount: 0,
        issueCount: 0,
        acceptedAmount: 0,
      },
      errorMessage: "Los filtros de comprobantes no son válidos.",
    };
  }

  const filters = parsed.data;
  if (
    context.role === "cashier" &&
    context.memberBranchId &&
    filters.branchId !== context.memberBranchId
  ) {
    filters.branchId = context.memberBranchId;
  }

  return listDocuments(context, filters);
}
