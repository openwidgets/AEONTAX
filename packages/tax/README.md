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

- Amounts supplied to the calculator are non-negative decimal strings with the rule-defined currency precision (0–6 fractional digits).
- Bracket upper bounds are integer minor units; the final bracket must have a `null` upper bound.
- Rates are integer basis points (10,000 = 100%).
- Rounding is half-up to the currency minor unit; the rule supplies the minor-unit precision.
- The input includes taxpayer reference, jurisdiction, tax type, tax year, effective date and currency.
- The result records the exact rule ID/version, source metadata, input snapshot, assumptions and bracket breakdown.

Do not use this package as a production tax filing or tax advice system until jurisdiction rules, currency precision requirements, legal rounding conventions, persistence, independent review and verification have been implemented.


## Imported worksheet and operations workflows

`src/workflows.ts` adapts selected workflows from `openwidgets/oopstax` into framework-independent TypeScript functions:

- US preparation worksheets: Form 1040 income bridge, business income, capital gains, estimated payments, payment/refund comparison and return consistency checks.
- Cross-jurisdiction operations: tax-code reference matching, fiscal-year matching, book-to-tax reconciliation, e-invoice status summaries, withholding review, VAT/GST reconciliation, sales-tax nexus screening, tax provision summaries and cross-border review.
- Income and withholding aggregation.

These are **review aids**, not tax-law implementations. They use caller-supplied rates, thresholds, classifications and periods where applicable. They do not determine filing obligations, eligibility, nexus, treaty relief, deductions, credits, VAT/GST recovery, provision accounting treatment or final liability. They do not query tax authorities or persist taxpayer documents.

The source repository describes its wider 91-workflow set as a mixture of in-memory workflows and metadata-only scaffolds. AEONTAX has not copied all 91 as if they were production capabilities. The imported functions are deliberately separated from the deterministic rule engine and carry explicit review warnings.
