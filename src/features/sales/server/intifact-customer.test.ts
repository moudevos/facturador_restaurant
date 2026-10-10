import { describe, expect, it } from "vitest";

import { buildIntifactCustomerFields } from "./intifact-customer";

describe("buildIntifactCustomerFields", () => {
  it("omite por completo los campos de documento para Cliente varios", () => {
    const fields = buildIntifactCustomerFields({
      customerId: null,
      documentType: null,
      documentNumber: null,
      name: "CLIENTE VARIOS",
      address: null,
    });

    expect(fields).toEqual({});
    expect(fields).not.toHaveProperty("clienteNumDoc");
    expect(fields).not.toHaveProperty("clienteTipoDoc");
  });

  it("envía un cliente identificado sin valores null", () => {
    const fields = buildIntifactCustomerFields({
      customerId: "c1",
      documentType: "1",
      documentNumber: "73531356",
      name: "Mauricio Paino",
      address: "Av. Ejemplo 123",
    });

    expect(fields).toEqual({
      clienteTipoDoc: "1",
      clienteNumDoc: "73531356",
      clienteRazonSocial: "Mauricio Paino",
      clienteDireccion: "Av. Ejemplo 123",
    });
  });

  it("rechaza un cliente registrado con snapshot fiscal incompleto", () => {
    expect(() =>
      buildIntifactCustomerFields({
        customerId: "c1",
        documentType: "1",
        documentNumber: null,
        name: "Cliente",
        address: null,
      }),
    ).toThrow("documento fiscal completo");
  });
});
