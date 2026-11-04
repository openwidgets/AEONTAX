import { describe, expect, it } from "vitest";
import { calculateProgressiveTax, type ProgressiveTaxRule, type TaxCalculationInput } from "./index";

const rule = (minorUnitDigits: number, currency: string): ProgressiveTaxRule => ({
  id: "test-rule", version: "1", status: "PUBLISHED", jurisdiction: "TEST", taxType: "INCOME",
  taxYear: "2026", effectiveFrom: "2026-01-01", effectiveTo: null, currency, minorUnitDigits,
  rounding: "HALF_UP",
  brackets: [
    { upperBoundMinor: String(50 * 10 ** minorUnitDigits), rateBps: 1000 },
    { upperBoundMinor: null, rateBps: 2000 },
  ],
  source: { title: "Test rule", authority: "Test authority", url: "https://example.invalid/rule", retrievedAt: "2026-11-04" },
});

const input = (currency: string, taxableAmount: string): TaxCalculationInput => ({
  taxpayerReference: "TEST-1", jurisdiction: "TEST", taxType: "INCOME", taxYear: "2026",
  asOfDate: "2026-06-01", taxableAmount, currency,
});

describe("deterministic progressive tax calculator", () => {
  it("calculates progressive brackets with decimal minor units", () => {
    const result = calculateProgressiveTax(rule(2, "USD"), input("USD", "100.00"));
    expect(result.totalTax).toBe("15.00");
    expect(result.brackets.map((row) => row.taxMinor)).toEqual(["500", "1000"]);
  });

  it("supports zero-decimal currencies", () => {
    const result = calculateProgressiveTax(rule(0, "JPY"), input("JPY", "100"));
    expect(result.totalTax).toBe("15");
  });

  it("supports three-decimal currencies", () => {
    const result = calculateProgressiveTax(rule(3, "BHD"), input("BHD", "100.000"));
    expect(result.totalTax).toBe("15.000");
  });

  it("rejects amounts with excess currency precision", () => {
    expect(() => calculateProgressiveTax(rule(2, "USD"), input("USD", "1.001"))).toThrow(/at most 2 fractional digits/);
  });

  it("rejects impossible calendar dates", () => {
    expect(() => calculateProgressiveTax(rule(2, "USD"), { ...input("USD", "10.00"), asOfDate: "2026-02-30" })).toThrow(/valid YYYY-MM-DD/);
  });

  it("rejects a rule that is not published", () => {
    expect(() => calculateProgressiveTax({ ...rule(2, "USD"), status: "DRAFT" }, input("USD", "10.00"))).toThrow(/only PUBLISHED/);
  });
});
