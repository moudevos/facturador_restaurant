import { describe, expect, it } from "vitest";
import { calculateSimpleResult } from "./money";

describe("calculateSimpleResult", () => {
  it("resta egresos a los ingresos facturados", () => {
    expect(calculateSimpleResult(1000, 350)).toBe(650);
  });
});
