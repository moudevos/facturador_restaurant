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
