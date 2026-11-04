import { randomUUID } from "node:crypto";
import type {
  ProgressiveTaxRule,
  TaxBracketResult,
  TaxCalculationInput,
  TaxCalculationResult,
} from "./types";

const BASIS_POINTS = 10_000n;

function parseMinorUnits(amount: string, field: string, digits: number): bigint {
  if (typeof amount !== "string") throw new Error(`${field} must be a decimal string`);
  const [whole, fraction, extra] = amount.split(".");
  const wholeIsValid = typeof whole === "string" && /^(0|[1-9][0-9]*)$/.test(whole);
  const fractionIsValid = fraction === undefined
    ? true
    : digits > 0 && /^[0-9]+$/.test(fraction) && fraction.length <= digits;
  if (typeof amount !== "string" || !wholeIsValid || !fractionIsValid || extra !== undefined) {
    throw new Error(`${field} must be a non-negative decimal string with at most ${digits} fractional digits`);
  }
  const factor = 10n ** BigInt(digits);
  const fractionalMinor = digits === 0 ? 0n : BigInt(((fraction ?? "") + "0".repeat(digits)).slice(0, digits) || "0");
  return BigInt(whole) * factor + fractionalMinor;
}

function formatMajorUnits(minor: bigint, digits: number): string {
  if (digits === 0) return minor.toString();
  const factor = 10n ** BigInt(digits);
  const whole = minor / factor;
  const fraction = (minor % factor).toString().padStart(digits, "0");
  return `${whole}.${fraction}`;
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error("invalid rounding operands");
  return (numerator + denominator / 2n) / denominator;
}

function assertIsoDate(value: string, field: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
}

export function validateProgressiveRule(rule: ProgressiveTaxRule): void {
  for (const [field, value] of Object.entries({
    id: rule.id,
    version: rule.version,
    jurisdiction: rule.jurisdiction,
    taxType: rule.taxType,
    taxYear: rule.taxYear,
    currency: rule.currency,
  })) {
    if (!value?.trim()) throw new Error(`rule.${field} is required`);
  }
  assertIsoDate(rule.effectiveFrom, "rule.effectiveFrom");
  if (rule.effectiveTo) {
    assertIsoDate(rule.effectiveTo, "rule.effectiveTo");
    if (rule.effectiveTo < rule.effectiveFrom) throw new Error("rule.effectiveTo cannot precede effectiveFrom");
  }
  if (rule.status !== "PUBLISHED") throw new Error("only PUBLISHED tax rules can be used for calculations");
  if (!Number.isInteger(rule.minorUnitDigits) || rule.minorUnitDigits < 0 || rule.minorUnitDigits > 6) throw new Error("rule.minorUnitDigits must be an integer between 0 and 6");
  if (rule.rounding !== "HALF_UP") throw new Error("unsupported rounding mode");
  if (!rule.source?.title?.trim() || !rule.source.authority?.trim() || !rule.source.url?.trim() || !rule.source.retrievedAt?.trim()) {
    throw new Error("rule source title, authority, URL and retrievedAt are required");
  }
  if (!Array.isArray(rule.brackets) || rule.brackets.length === 0) throw new Error("rule must contain at least one bracket");

  let previousUpper: bigint | null = null;
  rule.brackets.forEach((bracket, index) => {
    if (!Number.isInteger(bracket.rateBps) || bracket.rateBps < 0 || bracket.rateBps > 100_000) {
      throw new Error(`brackets[${index}].rateBps must be an integer between 0 and 100000`);
    }
    if (bracket.upperBoundMinor === null) {
      if (index !== rule.brackets.length - 1) throw new Error("only the final bracket may have an unlimited upper bound");
      return;
    }
    if (!/^(0|[1-9]\d*)$/.test(bracket.upperBoundMinor)) throw new Error(`brackets[${index}].upperBoundMinor must be an integer minor-unit string`);
    const upper = BigInt(bracket.upperBoundMinor);
    if (upper <= 0n || (previousUpper !== null && upper <= previousUpper)) {
      throw new Error("bracket upper bounds must be positive and strictly increasing");
    }
    previousUpper = upper;
  });
  if (rule.brackets[rule.brackets.length - 1].upperBoundMinor !== null) {
    throw new Error("final bracket must have an unlimited upper bound (null)");
  }
}

export function calculateProgressiveTax(
  rule: ProgressiveTaxRule,
  input: TaxCalculationInput,
): TaxCalculationResult {
  validateProgressiveRule(rule);
  assertIsoDate(input.asOfDate, "input.asOfDate");
  if (input.jurisdiction !== rule.jurisdiction) throw new Error("jurisdiction does not match the selected rule");
  if (input.taxType !== rule.taxType) throw new Error("tax type does not match the selected rule");
  if (input.taxYear !== rule.taxYear) throw new Error("tax year does not match the selected rule");
  if (input.currency.toUpperCase() !== rule.currency.toUpperCase()) throw new Error("currency does not match the selected rule");
  if (input.asOfDate < rule.effectiveFrom || (rule.effectiveTo !== null && input.asOfDate > rule.effectiveTo)) {
    throw new Error("selected rule is not effective on the calculation date");
  }
  if (!input.taxpayerReference?.trim()) throw new Error("taxpayerReference is required");

  const taxableAmountMinor = parseMinorUnits(input.taxableAmount, "taxableAmount", rule.minorUnitDigits);
  const rows: TaxBracketResult[] = [];
  let lower = 0n;
  let remaining = taxableAmountMinor;
  let totalTaxMinor = 0n;

  for (const bracket of rule.brackets) {
    const upper = bracket.upperBoundMinor === null ? null : BigInt(bracket.upperBoundMinor);
    const capacity = upper === null ? remaining : upper - lower;
    const taxableInBracket = remaining < capacity ? remaining : capacity;
    const taxMinor = roundHalfUp(taxableInBracket * BigInt(bracket.rateBps), BASIS_POINTS);
    rows.push({
      lowerBoundMinor: lower.toString(),
      upperBoundMinor: upper?.toString() ?? null,
      taxableInBracketMinor: taxableInBracket.toString(),
      rateBps: bracket.rateBps,
      taxMinor: taxMinor.toString(),
    });
    totalTaxMinor += taxMinor;
    remaining -= taxableInBracket;
    if (remaining === 0n) break;
    if (upper === null) throw new Error("taxable amount exceeds the final bracket");
    lower = upper;
  }

  if (remaining > 0n) throw new Error("tax rule does not cover the complete taxable amount");

  return {
    calculationId: randomUUID(),
    taxpayerReference: input.taxpayerReference,
    jurisdiction: input.jurisdiction,
    taxType: input.taxType,
    taxYear: input.taxYear,
    calculatedAt: new Date().toISOString(),
    rule: {
      id: rule.id,
      version: rule.version,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      source: rule.source,
    },
    input: { ...input, assumptions: [...(input.assumptions ?? [])] },
    taxableAmountMinor: taxableAmountMinor.toString(),
    currency: rule.currency,
    brackets: rows,
    totalTaxMinor: totalTaxMinor.toString(),
    totalTax: formatMajorUnits(totalTaxMinor, rule.minorUnitDigits),
    assumptions: [...(input.assumptions ?? [])],
    engine: {
      name: "AEONTAX deterministic progressive calculator",
      version: "0.1.0",
      rounding: "HALF_UP",
    },
  };
}
