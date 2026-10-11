export type FiscalCustomerSnapshot = {
  customerId: string | null;
  documentType: string | null;
  documentNumber: string | null;
  name: string | null;
  address: string | null;
};

export function buildIntifactCustomerFields(
  customer: FiscalCustomerSnapshot,
): Record<string, string> {
  if (!customer.customerId) {
    // SUNAT allows a boleta without buyer identification for consumer
    // transactions <= S/ 700. Preserve the real display name and never
    // forge a DNI/RUC or send a null document number.
    return { clienteRazonSocial: customer.name?.trim() || "CLIENTE VARIOS" };
  }

  if (
    !customer.documentType ||
    !customer.documentNumber ||
    !customer.name
  ) {
    throw new Error(
      "El cliente registrado no tiene un documento fiscal completo.",
    );
  }

  return {
    clienteTipoDoc: customer.documentType,
    clienteNumDoc: customer.documentNumber,
    clienteRazonSocial: customer.name,
    ...(customer.address
      ? { clienteDireccion: customer.address }
      : {}),
  };
}
