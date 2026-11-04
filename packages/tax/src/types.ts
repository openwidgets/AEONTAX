/**
 * AEONTAX jurisdiction rule contracts.
 *
 * Monetary values crossing the engine boundary are decimal strings in the
 * currency's major unit. Bracket thresholds are integer minor units. Rates
 * are basis points (10,000 = 100%). No jurisdiction rules are bundled here:
 * rule data must be sourced, reviewed and published separately.
 */

export type TaxRuleSource = {
  title: string;
  authority: string;
  url: string;
  publishedAt?: string;
  retrievedAt: string;
  citation?: string;
};

export type TaxBracket = {
  /** Inclusive lower bound, derived from the previous bracket's upper bound. */
  upperBoundMinor: string | null;
  /** Rate in basis points: 1,000 = 10%. */
  rateBps: number;
};

export type ProgressiveTaxRule = {
  id: string;
  version: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  jurisdiction: string;
  taxType: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  rounding: "HALF_UP";
  brackets: TaxBracket[];
  source: TaxRuleSource;
};

export type TaxCalculationInput = {
  taxpayerReference: string;
  jurisdiction: string;
  taxType: string;
  taxYear: string;
  asOfDate: string;
  /** Taxable base after separately evidenced deductions/adjustments. */
  taxableAmount: string;
  currency: string;
  assumptions?: string[];
};

export type TaxBracketResult = {
  lowerBoundMinor: string;
  upperBoundMinor: string | null;
  taxableInBracketMinor: string;
  rateBps: number;
  taxMinor: string;
};

export type TaxCalculationResult = {
  calculationId: string;
  taxpayerReference: string;
  jurisdiction: string;
  taxType: string;
  taxYear: string;
  calculatedAt: string;
  rule: {
    id: string;
    version: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    source: TaxRuleSource;
  };
  input: TaxCalculationInput;
  taxableAmountMinor: string;
  currency: string;
  brackets: TaxBracketResult[];
  totalTaxMinor: string;
  totalTax: string;
  assumptions: string[];
  engine: {
    name: "AEONTAX deterministic progressive calculator";
    version: "0.1.0";
    rounding: "HALF_UP";
  };
};
