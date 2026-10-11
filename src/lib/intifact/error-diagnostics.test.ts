import { describe, expect, it } from "vitest";
import { buildIntifactHttpDiagnostic, formatIntifactError } from "./error-diagnostics";

describe("Intifact HTTP error diagnostics", () => {
  it("preserves complete nested validation body while redacting secrets", () => {
    const response = {
      message: "Error de validación",
      errors: {
        clienteTipoDoc: ["El tipo de documento es requerido"],
        clienteNumDoc: ["El documento está ausente"],
      },
      authorization: "Bearer fact_test_private123",
      data: { secret: "fact_live_secret123" },
    };
    const diagnostic = buildIntifactHttpDiagnostic(
      400, response, "request-001",
    );
    expect(diagnostic.httpStatus).toBe(400);
    expect(diagnostic.truncated).toBe(false);
    expect(diagnostic.response).toEqual({
      ...response,
      authorization: "[REDACTED]",
      data: { secret: "[REDACTED]" },
    });
    expect(diagnostic.requestId).toBe("request-001");
    expect(JSON.stringify(diagnostic)).not.toContain("fact_test_private123");
    expect(JSON.stringify(diagnostic)).not.toContain("fact_live_secret123");
  });

  it("shows provider field errors without requiring a particular nesting shape", () => {
    expect(formatIntifactError({
      message: "Error de validación",
      errors: { clienteTipoDoc: ["requerido"] },
    }, 400)).toContain("clienteTipoDoc: requerido");

    expect(formatIntifactError({
      error: {
        message: "Campos inválidos",
        details: [{ path: ["cliente", "numero"], msg: "no puede estar vacío" }],
      },
    }, 400)).toContain("cliente.numero: no puede estar vacío");
  });

  it("does not invent absent identity fields or treat generic 400 as success", () => {
    const message = formatIntifactError("Request body is invalid", 400);
    expect(message).toContain("HTTP 400");
    expect(message).toContain("Request body is invalid");
  });

  it("caps very large responses without losing HTTP status", () => {
    const diagnostic = buildIntifactHttpDiagnostic(
      400,
      { details: "a".repeat(60_000) },
      null,
    );
    expect(diagnostic.truncated).toBe(true);
    expect(diagnostic.httpStatus).toBe(400);
  });
});
