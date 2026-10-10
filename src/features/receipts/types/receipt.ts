import type {
  ReceiptPaperWidth,
  ReceiptPrinterMode,
} from "@/features/settings/types";

export type ReceiptItem = {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type ReceiptData = {
  saleId: string;
  documentNumber: string;
  documentTypeLabel: string;
  fiscalDate: string;
  acceptedAt: string | null;
  displayName: string;
  legalName: string;
  ruc: string;
  branchName: string;
  branchAddress: string | null;
  clientName: string;
  clientDocument: string | null;
  paymentLabel: string | null;
  items: ReceiptItem[];
  taxableAmount: number;
  exoneratedAmount: number;
  unaffectedAmount: number;
  igvAmount: number;
  totalAmount: number;
  logoUrl: string | null;
  footerText: string | null;
  showProductCode: boolean;
  showPaymentMethod: boolean;
  paperWidth: ReceiptPaperWidth;
  printerMode: ReceiptPrinterMode;
  autoPrint: boolean;
  verificationUrl: string;
  isTest: boolean;
};
