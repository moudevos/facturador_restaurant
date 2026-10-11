import { beforeEach, describe, expect, it, vi } from "vitest";

import { listCompanies } from "@/lib/intifact/client";
import { createClient } from "@/lib/supabase/server";
import type { SalesContext } from "./context";
import { assertIntifactIssuerReady } from "./intifact-preflight";

vi.mock("@/lib/intifact/client", () => ({ listCompanies: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function mockIssuerRuc(ruc: string) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { ruc },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn().mockReturnValue({ select }),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function context(organizationId: string) {
  return { organizationId } as SalesContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INTIFACT_API_KEY = "fact_test_preflight_unit";
});

describe("Intifact issuer preflight", () => {
  it("rejects unregistered RUC before any fiscal number is allocated", async () => {
    mockIssuerRuc("10735313563");
    vi.mocked(listCompanies).mockResolvedValue([]);

    await expect(assertIntifactIssuerReady(context("org-missing")))
      .rejects.toThrow("no está vinculado");
  });

  it("caches successful checks briefly to avoid one provider call per sale", async () => {
    mockIssuerRuc("20100000001");
    vi.mocked(listCompanies).mockResolvedValue([
      { id: "issuer-1", ruc: "20100000001", razonSocial: "Empresa" },
    ]);

    const ctx = context("org-registered");
    await assertIntifactIssuerReady(ctx);
    await assertIntifactIssuerReady(ctx);

    expect(listCompanies).toHaveBeenCalledTimes(1);
  });
});
