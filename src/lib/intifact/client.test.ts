import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeIntifactError, findDocumentByFiscalIdentity } from "./client";

const originalKey = process.env.INTIFACT_API_KEY;

beforeEach(() => {
  process.env.INTIFACT_API_KEY = "fact_test_unit_test";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.INTIFACT_API_KEY;
  else process.env.INTIFACT_API_KEY = originalKey;
});

function jsonResponse(data: unknown, totalPages: number) {
  return {
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      success: true,
      data,
      pagination: { page: 1, limit: 100, totalPages },
    }),
  } as Response;
}

describe("Intifact fiscal identity reconciliation", () => {
  it("searches later pages instead of incorrectly returning not found", async () => {
    const firstPage = Array.from({ length: 100 }, (_, n) => ({
      id: `other-${n}`,
      tipoDoc: "03",
      serie: "B001",
      correlativo: String(n + 100),
      estadoSunat: "ACEPTADO",
    }));

    const fetchMock = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return page === 1
        ? jsonResponse(firstPage, 2)
        : jsonResponse([
            {
              id: "existing-document",
              tipoDoc: "03",
              serie: "B001",
              correlativo: "00000002",
              estadoSunat: "ACEPTADO",
            },
          ], 2);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await findDocumentByFiscalIdentity({
      ruc: "10735313563",
      documentType: "03",
      series: "B001",
      correlative: 2,
    });

    expect(result).toEqual({ id: "existing-document", estado: "ACEPTADO" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates a failed API lookup instead of claiming the document is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Rate limit" }),
    }) as Response));

    await expect(
      findDocumentByFiscalIdentity({
        ruc: "10735313563",
        documentType: "03",
        series: "B001",
        correlative: 2,
      }),
    ).rejects.toThrow("Rate limit");
  });

  it("includes field errors for provider validation failures", () => {
    expect(
      describeIntifactError({
        message: "Error de validación",
        errors: { clienteTipoDoc: ["Campo requerido"] },
      }, 400),
    ).toContain("clienteTipoDoc: Campo requerido");
  });
});
