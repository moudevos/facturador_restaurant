import { describe, expect, it } from "vitest";

import { formatBusinessDateOnly, getBusinessDateISO } from "./date-time";

describe("date-time", () => {
  it("formatea una fecha de negocio sin convertirla a UTC ni desplazar el día", () => {
    expect(formatBusinessDateOnly("2026-10-10")).toBe("10/10/2026");
  });

  it("calcula correctamente la fecha de Perú para un instante UTC cercano a medianoche", () => {
    expect(getBusinessDateISO("2026-10-10T03:30:00Z", "America/Lima")).toBe("2026-10-09");
  });
});
