export type SettingsActionResult = {
  success: boolean;
  message: string;
};

export type SettingsListResult<T> = {
  data: T[];
  errorMessage: string | null;
};

export type Branch = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  ubigeo: string | null;
  sunat_establishment_code?: string | null;
  active: boolean;
};

export type DocumentSequence = {
  id: string;
  branch_id: string;
  document_type: "01" | "03";
  series: string;
  current_value: number;
  active: boolean;
};

export type OrganizationMember = {
  member_id: string;
  user_id: string;
  email: string | null;
  role: "owner" | "cashier";
  branch_id: string | null;
  active: boolean;
  created_at: string;
};

export type ReceiptPaperWidth = "48" | "58" | "80" | "a4";
export type ReceiptPrinterMode =
  | "system"
  | "bluetooth-ble"
  | "android-bridge";

export type ReceiptSettings = {
  organization_id: string;
  logo_path: string | null;
  logo_url: string | null;
  footer_text: string | null;
  paper_width: ReceiptPaperWidth;
  printer_mode: ReceiptPrinterMode;
  auto_print: boolean;
  show_product_code: boolean;
  show_payment_method: boolean;
};

export type IssuerFiscalProfile = {
  ruc: string;
  legalName: string;
  tradeName: string | null;
  verified: boolean;
  verifiedAt: string | null;
  sunatStatus: string | null;
  sunatCondition: string | null;
  fiscalAddress: string | null;
  fiscalUbigeo: string | null;
  intifactCompanyId: string | null;
  intifactVerifiedAt: string | null;
};

export type SunatEstablishment = {
  code: string;
  type: string;
  activity: string | null;
  address: string;
  department: string | null;
  province: string | null;
  district: string | null;
  ubigeo: string | null;
  intifactRegistered: boolean;
  localImported: boolean;
};
