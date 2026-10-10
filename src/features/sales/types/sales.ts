export type PaymentMethod = "cash" | "yape" | "plin" | "card" | "transfer";
export type DocumentType = "01" | "03";

export const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; icon: string }> = [
  { value: "cash", label: "Efectivo", icon: "💵" },
  { value: "yape", label: "Yape", icon: "📱" },
  { value: "plin", label: "Plin", icon: "💜" },
  { value: "card", label: "Tarjeta", icon: "💳" },
  { value: "transfer", label: "Transferencia", icon: "🏦" },
];

export type Customer = {
  id: string;
  document_type: "1" | "6";
  document_number: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
};

export type SalesSessionSummary = {
  session_id: string;
  organization_id: string;
  branch_id: string;
  cashier_user_id: string;
  status: "open" | "closed";
  opening_cash: string | number;
  opening_note: string | null;
  opened_at: string;
  closed_at: string | null;
  closed_expected_cash: string | number | null;
  counted_cash: string | number | null;
  cash_difference: string | number | null;
  closing_note: string | null;
  sales_count: number;
  total_sales: string | number;
  cash_sales: string | number;
  yape_sales: string | number;
  plin_sales: string | number;
  card_sales: string | number;
  transfer_sales: string | number;
  cash_in: string | number;
  cash_out: string | number;
  current_expected_cash: string | number;
};

export type CashMovement = {
  id: string;
  movement_type: "in" | "out";
  reason_code: "change" | "cash_in" | "safe_withdrawal" | "supplies" | "supplier_payment" | "other";
  description: string | null;
  amount: string | number;
  created_at: string;
};

export type RecentSale = {
  id: string;
  series: string;
  correlative: number;
  customer_name: string | null;
  total_amount: string | number;
  created_at: string;
  payment_method: PaymentMethod | null;
};
