# @aeontax/tax

Deterministic, versioned tax calculation primitives for AEONTAX.

## Scope of this increment

- Explicit contracts for jurisdiction-specific progressive tax rules.
- Effective-date and publication-state validation.
- Source metadata required on every published rule.
- Decimal-string inputs and integer minor-unit arithmetic using `bigint`.
- Reproducible bracket-by-bracket calculation breakdown.
- Rule version registry that prevents accidental version replacement.

## Important limitations

This package intentionally ships with **no country tax rates, tax brackets, deductions, credits, exemptions or filing rules**. A rule is usable only after jurisdiction-specific data has been sourced, reviewed and published. The calculator accepts a taxable base after deductions and adjustments; it does not determine those adjustments.

The registry is currently in-memory. Persistent storage, approval/version publication workflows, jurisdiction master data, tax-year rule ingestion and authority integrations remain separate implementation increments.

## Calculation contract

- Amounts supplied to the calculator are non-negative decimal strings with at most two fractional digits.
- Bracket upper bounds are integer minor units; the final bracket must have a `null` upper bound.
- Rates are integer basis points (10,000 = 100%).
- Rounding is half-up to the currency minor unit.
- The input includes taxpayer reference, jurisdiction, tax type, tax year, effective date and currency.
- The result records the exact rule ID/version, source metadata, input snapshot, assumptions and bracket breakdown.

Do not use this package as a production tax filing or tax advice system until jurisdiction rules, currency precision requirements, legal rounding conventions, persistence, independent review and verification have been implemented.
