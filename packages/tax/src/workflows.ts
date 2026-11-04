/**
 * Review and reconciliation workflows adapted from openwidgets/oopstax.
 *
 * These functions are worksheet helpers only. They do not encode tax law,
 * decide eligibility, query authorities, prepare a complete return, or file.
 * Use ProgressiveTaxRule + calculateProgressiveTax for reviewed, published
 * jurisdiction rules instead of treating a user-entered rate as legal advice.
 */

export type FilingStatus =
  | "single"
  | "married_filing_jointly"
  | "married_filing_separately"
  | "head_of_household"
  | "qualifying_surviving_spouse";

export type WorksheetWarning = { warning: string; reviewRequired: true };

const roundMoney = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error("amounts must be finite numbers");
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const nonNegative = (value: number, field: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative amount`);
  return roundMoney(value);
};

const add = (values: number[]) => roundMoney(values.reduce((sum, value) => sum + value, 0));

export type Form1040WorksheetInput = {
  wages?: number;
  taxableInterest?: number;
  dividends?: number;
  businessIncome?: number;
  capitalGain?: number;
  otherIncome?: number;
  adjustments?: number;
  deduction?: number;
  withholding?: number;
  estimatedPayments?: number;
};

export function calculateForm1040Worksheet(input: Form1040WorksheetInput) {
  const wages = roundMoney(input.wages ?? 0);
  const taxableInterest = roundMoney(input.taxableInterest ?? 0);
  const dividends = roundMoney(input.dividends ?? 0);
  const businessIncome = roundMoney(input.businessIncome ?? 0);
  const capitalGain = roundMoney(input.capitalGain ?? 0);
  const otherIncome = roundMoney(input.otherIncome ?? 0);
  const adjustments = nonNegative(input.adjustments ?? 0, "adjustments");
  const deduction = nonNegative(input.deduction ?? 0, "deduction");
  const withholding = nonNegative(input.withholding ?? 0, "withholding");
  const estimatedPayments = nonNegative(input.estimatedPayments ?? 0, "estimatedPayments");
  const totalIncome = add([wages, taxableInterest, dividends, businessIncome, capitalGain, otherIncome]);
  const adjustedGrossIncome = roundMoney(totalIncome - adjustments);
  const taxableIncome = Math.max(0, roundMoney(adjustedGrossIncome - deduction));
  return {
    incomeLines: { wages, taxableInterest, dividends, businessIncome, capitalGain, otherIncome },
    totalIncome, adjustments, adjustedGrossIncome, deduction, taxableIncome,
    paymentsAndWithholding: add([withholding, estimatedPayments]),
    estimatedTaxLiability: null,
    refundOrBalanceDue: null,
    reviewRequired: true as const,
    warning: "Preparation worksheet only. Tax liability, credits, additional taxes, limitations and refund/balance due are not calculated. Verify current Form 1040 instructions and approved tax software.",
  };
}

export function summarizeBusinessIncome(input: {
  grossReceipts: number; returnsAllowances?: number; costOfGoodsSold?: number;
  expenses?: Array<{ category: string; amount: number }>;
}) {
  const grossReceipts = roundMoney(input.grossReceipts);
  const returnsAllowances = nonNegative(input.returnsAllowances ?? 0, "returnsAllowances");
  const costOfGoodsSold = nonNegative(input.costOfGoodsSold ?? 0, "costOfGoodsSold");
  const expenses = (input.expenses ?? []).map((item) => ({
    category: item.category.trim(), amount: nonNegative(item.amount, "expense.amount"),
  }));
  const expenseTotal = add(expenses.map((item) => item.amount));
  return {
    grossReceipts, returnsAllowances, costOfGoodsSold, expenses, expenseTotal,
    estimatedNetBusinessIncome: roundMoney(grossReceipts - returnsAllowances - costOfGoodsSold - expenseTotal),
    reviewRequired: true as const,
    warning: "Worksheet only. Verify accounting method, inventory rules, deductible expenses, depreciation and applicable schedules.",
  };
}

export function summarizeCapitalGains(input: {
  transactions: Array<{ description: string; proceeds: number; basis: number; fees?: number; holdingPeriod: "short_term" | "long_term" | "unknown" }>;
  dividends?: number; interest?: number;
}) {
  const transactions = input.transactions.map((item) => {
    const proceeds = roundMoney(item.proceeds);
    const basis = roundMoney(item.basis);
    const fees = nonNegative(item.fees ?? 0, "fees");
    return { ...item, proceeds, basis, fees, netGainOrLoss: roundMoney(proceeds - basis - fees) };
  });
  const total = (period: "short_term" | "long_term" | "unknown") =>
    add(transactions.filter((item) => item.holdingPeriod === period).map((item) => item.netGainOrLoss));
  return {
    transactions, shortTermNet: total("short_term"), longTermNet: total("long_term"),
    unknownHoldingPeriodNet: total("unknown"), dividendIncome: roundMoney(input.dividends ?? 0),
    interestIncome: roundMoney(input.interest ?? 0), reviewRequired: true as const,
    warning: "No tax rates, wash-sale adjustments, basis corrections, loss limitations or tax-lot matching are applied.",
  };
}

export function summarizeEstimatedPayments(input: {
  targetPayment: number; payments: Array<{ date: string; amount: number; label?: string }>;
  priorYearTax?: number; currentYearTaxEstimate?: number;
}) {
  const targetPayment = nonNegative(input.targetPayment, "targetPayment");
  const payments = input.payments.map((item) => ({ ...item, amount: nonNegative(item.amount, "payment.amount") }));
  const totalPaid = add(payments.map((item) => item.amount));
  return {
    targetPayment, payments, totalPaid,
    remainingToTarget: roundMoney(Math.max(0, targetPayment - totalPaid)),
    overTarget: roundMoney(Math.max(0, totalPaid - targetPayment)),
    priorYearTax: input.priorYearTax ?? null,
    currentYearTaxEstimate: input.currentYearTaxEstimate ?? null,
    reviewRequired: true as const,
    warning: "Target is user-supplied. Confirm estimated-tax rules, due dates, safe harbors and penalty exceptions for the relevant tax year.",
  };
}

export function compareRefundBalance(input: {
  estimatedTaxLiability: number; withholding?: number; estimatedPayments?: number;
  refundableCredits?: number; otherPayments?: number;
}) {
  const liability = nonNegative(input.estimatedTaxLiability, "estimatedTaxLiability");
  const payments = add([
    nonNegative(input.withholding ?? 0, "withholding"),
    nonNegative(input.estimatedPayments ?? 0, "estimatedPayments"),
    nonNegative(input.refundableCredits ?? 0, "refundableCredits"),
    nonNegative(input.otherPayments ?? 0, "otherPayments"),
  ]);
  const difference = roundMoney(payments - liability);
  return {
    estimatedTaxLiability: liability, totalPaymentsAndRefundableCredits: payments,
    estimatedRefund: Math.max(0, difference), estimatedBalanceDue: Math.max(0, -difference),
    reviewRequired: true as const,
    warning: "Arithmetic comparison only. Liability and credit eligibility must be established using reviewed jurisdiction rules and approved tax software.",
  };
}

export function aggregateIncomeWithholding(items: Array<{
  category: "wages" | "interest" | "dividends" | "business" | "retirement" | "capital_gains" | "other";
  amount: number; withholding?: number; sourceLabel?: string;
}>) {
  const categories: Record<string, { income: number; withholding: number; items: number }> = {};
  for (const item of items) {
    const row = categories[item.category] ??= { income: 0, withholding: 0, items: 0 };
    row.income = add([row.income, roundMoney(item.amount)]);
    row.withholding = add([row.withholding, nonNegative(item.withholding ?? 0, "withholding")]);
    row.items += 1;
  }
  return {
    categories,
    totalIncome: add(items.map((item) => roundMoney(item.amount))),
    totalWithholding: add(items.map((item) => nonNegative(item.withholding ?? 0, "withholding"))),
    itemCount: items.length, reviewRequired: true as const,
    warning: "Reconcile against source documents; classification and deductibility are not determined by aggregation.",
  };
}

export function lookupTaxCode(code: string, references: Array<{ code: string; label: string; jurisdiction: string }>) {
  const matches = references.filter((item) => item.code.trim().toLowerCase() === code.trim().toLowerCase());
  return { code, matches, status: matches.length ? "reference_match" as const : "no_match" as const,
    warning: "User-maintained references only; verify with authoritative guidance." };
}

export function calculateUserRateWorksheet(input: {
  taxableBase: number; ratePercent: number; exemptAmount?: number; creditAmount?: number;
}) {
  const taxableBase = nonNegative(input.taxableBase, "taxableBase");
  const ratePercent = input.ratePercent;
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) throw new Error("ratePercent must be between 0 and 100");
  const exemptAmount = nonNegative(input.exemptAmount ?? 0, "exemptAmount");
  const creditAmount = nonNegative(input.creditAmount ?? 0, "creditAmount");
  const netTaxableBase = Math.max(0, roundMoney(taxableBase - exemptAmount));
  const calculatedTax = roundMoney(netTaxableBase * ratePercent / 100);
  return {
    taxableBase, netTaxableBase, ratePercent, calculatedTax,
    netTaxAfterCredits: Math.max(0, roundMoney(calculatedTax - creditAmount)),
    reviewRequired: true as const,
    warning: "Arithmetic worksheet only; does not determine legal tax treatment, rates, deductions, exemptions or credits.",
  };
}

export function matchFiscalYear(date: string, configuredYears: Array<{ label: string; startDate: string; endDate: string }>) {
  const target = Date.parse(date);
  if (!Number.isFinite(target)) throw new Error("date must be a valid date");
  const matches = configuredYears.filter((period) => {
    const start = Date.parse(period.startDate), end = Date.parse(period.endDate);
    return Number.isFinite(start) && Number.isFinite(end) && start <= end && target >= start && target <= end;
  });
  return { date, matches, status: matches.length === 1 ? "matched" as const : matches.length ? "overlap" as const : "no_match" as const,
    warning: "Only supplied periods are checked; confirm the entity's approved fiscal calendar." };
}

export function reconcileBookTax(items: Array<{
  reference: string; bookAmount: number; taxAmount: number; type: "temporary" | "permanent" | "unclassified";
}>) {
  const rows = items.map((item) => ({ ...item, difference: roundMoney(item.taxAmount - item.bookAmount) }));
  const total = (type: string) => add(rows.filter((row) => row.type === type).map((row) => row.difference));
  return { items: rows, temporaryDifference: total("temporary"), permanentDifference: total("permanent"),
    unclassifiedDifference: total("unclassified"), reviewRequired: true as const,
    warning: "Summary only; tax treatment and accounting-standard classification require professional review." };
}

export function summarizeEInvoiceStatus(invoices: Array<{
  reference: string; status: "draft" | "validated" | "submitted" | "accepted" | "rejected" | "cancelled" | "unknown";
  authorityReference?: string;
}>) {
  const states = ["draft", "validated", "submitted", "accepted", "rejected", "cancelled", "unknown"] as const;
  const statusCounts = Object.fromEntries(states.map((state) => [state, invoices.filter((item) => item.status === state).length]));
  return {
    total: invoices.length, statusCounts,
    missingAuthorityReferences: invoices.filter((item) => ["submitted", "accepted"].includes(item.status) && !item.authorityReference).map((item) => item.reference),
    warning: "Statuses are user-supplied; no tax authority is queried.",
  };
}

export function reviewWithholding(payments: Array<{
  reference: string; grossAmount: number; withheldAmount: number; documentationReviewed: boolean; treatyReliefApplied: boolean;
}>) {
  const rows = payments.map((item) => {
    const grossAmount = nonNegative(item.grossAmount, "grossAmount");
    const withheldAmount = nonNegative(item.withheldAmount, "withheldAmount");
    return {
      ...item, grossAmount, withheldAmount,
      effectiveRatePercent: grossAmount ? roundMoney(withheldAmount / grossAmount * 100) : 0,
      reviewFlags: [
        ...(withheldAmount > grossAmount ? ["withholding_exceeds_gross"] : []),
        ...(!item.documentationReviewed ? ["documentation_review_missing"] : []),
        ...(item.treatyReliefApplied && !item.documentationReviewed ? ["treaty_review_missing"] : []),
      ],
    };
  });
  return {
    payments: rows, totalGross: add(rows.map((item) => item.grossAmount)),
    totalWithheld: add(rows.map((item) => item.withheldAmount)), reviewRequired: true as const,
    warning: "Does not determine treaty eligibility, withholding rates or filing obligations.",
  };
}

export function reconcileVatGst(input: {
  outputTax: number; inputTaxClaimed: number; inputTaxEligible: number; reportedNetTax: number;
  tolerance?: number; currency?: string;
}) {
  const outputTax = nonNegative(input.outputTax, "outputTax");
  const inputTaxClaimed = nonNegative(input.inputTaxClaimed, "inputTaxClaimed");
  const inputTaxEligible = nonNegative(input.inputTaxEligible, "inputTaxEligible");
  const reportedNetTax = roundMoney(input.reportedNetTax);
  const tolerance = nonNegative(input.tolerance ?? 0.02, "tolerance");
  const computedNetTax = roundMoney(outputTax - inputTaxEligible);
  const variance = roundMoney(reportedNetTax - computedNetTax);
  return {
    currency: (input.currency ?? "USD").toUpperCase(), computedNetTax, reportedNetTax, variance,
    withinTolerance: Math.abs(variance) <= tolerance, inputTaxClaimed, inputTaxEligible,
    reviewRequired: true as const, warning: "Does not determine input tax recovery eligibility or jurisdiction-specific VAT/GST treatment.",
  };
}

export function screenSalesTaxNexus(jurisdictions: Array<{
  code: string; salesAmount: number; transactionCount: number; salesThreshold: number;
  transactionThreshold: number; physicalPresence: boolean; registered: boolean;
}>) {
  const rows = jurisdictions.map((item) => {
    const salesAmount = nonNegative(item.salesAmount, "salesAmount");
    const transactionCount = nonNegative(item.transactionCount, "transactionCount");
    const salesThreshold = nonNegative(item.salesThreshold, "salesThreshold");
    const transactionThreshold = nonNegative(item.transactionThreshold, "transactionThreshold");
    const salesThresholdReached = salesAmount >= salesThreshold;
    const transactionThresholdReached = transactionCount >= transactionThreshold;
    const possibleRegistrationGap = (item.physicalPresence || salesThresholdReached || transactionThresholdReached) && !item.registered;
    return { ...item, salesAmount, transactionCount, salesThresholdReached, transactionThresholdReached,
      reviewPriority: item.physicalPresence || salesThresholdReached || transactionThresholdReached ? "high" as const : "normal" as const,
      possibleRegistrationGap };
  });
  return { jurisdictions: rows, possibleRegistrationGaps: rows.filter((item) => item.possibleRegistrationGap).map((item) => item.code),
    reviewRequired: true as const, warning: "Screening only; configured thresholds are not a legal nexus determination." };
}

export function summarizeTaxProvision(input: {
  currency?: string; pretaxIncome: number; permanentDifferences?: number; temporaryDifferences?: number;
  currentTaxExpense: number; deferredTaxExpense: number; discreteItems?: Array<{ label: string; amount: number }>;
}) {
  const pretaxIncome = roundMoney(input.pretaxIncome);
  const permanentDifferences = roundMoney(input.permanentDifferences ?? 0);
  const temporaryDifferences = roundMoney(input.temporaryDifferences ?? 0);
  const currentTaxExpense = nonNegative(input.currentTaxExpense, "currentTaxExpense");
  const deferredTaxExpense = roundMoney(input.deferredTaxExpense);
  const discreteItems = (input.discreteItems ?? []).map((item) => ({ label: item.label, amount: roundMoney(item.amount) }));
  const discreteItemsTotal = add(discreteItems.map((item) => item.amount));
  const totalProvision = add([currentTaxExpense, deferredTaxExpense, discreteItemsTotal]);
  const taxBaseBridge = add([pretaxIncome, permanentDifferences, temporaryDifferences]);
  return {
    currency: (input.currency ?? "USD").toUpperCase(), taxBaseBridge, currentTaxExpense, deferredTaxExpense,
    discreteItems, discreteItemsTotal, totalProvision,
    effectiveRatePercent: taxBaseBridge ? roundMoney(totalProvision / taxBaseBridge * 100) : null,
    reviewRequired: true as const, warning: "Provision worksheet only; no accounting standard or jurisdiction rule is applied.",
  };
}

export function reviewCrossBorderPayments(payments: Array<{
  reference: string; payerJurisdiction: string; payeeJurisdiction: string;
  paymentType: "services" | "royalty" | "interest" | "dividend" | "goods" | "other";
  grossAmount: number; withholdingReviewed: boolean; treatyDocumentationReviewed: boolean;
  indirectTaxReviewed: boolean; permanentEstablishmentReviewed: boolean;
}>) {
  const rows = payments.map((item) => ({
    ...item, grossAmount: nonNegative(item.grossAmount, "grossAmount"),
    reviewGaps: [
      ...(!item.withholdingReviewed ? ["withholding_review"] : []),
      ...(!item.treatyDocumentationReviewed ? ["treaty_documentation_review"] : []),
      ...(!item.indirectTaxReviewed ? ["indirect_tax_review"] : []),
      ...(!item.permanentEstablishmentReviewed ? ["permanent_establishment_review"] : []),
    ],
  }));
  return {
    count: rows.length, totalGross: add(rows.map((item) => item.grossAmount)),
    needsSpecialistReview: rows.filter((item) => item.reviewGaps.length).map((item) => ({ reference: item.reference, reviewGaps: item.reviewGaps })),
    reviewRequired: true as const, warning: "Checklist only; no treaty, withholding, permanent-establishment or tax obligation is determined.",
  };
}

export function validateReturnWorksheet(input: {
  totalIncome: number; adjustments: number; adjustedGrossIncome: number; deduction: number;
  taxableIncome: number; taxpayerNamePresent?: boolean; taxpayerIdVerified?: boolean; requiredDocumentsComplete?: boolean;
}) {
  const findings: Array<{ severity: "error" | "warning"; code: string; message: string }> = [];
  if (roundMoney(input.adjustedGrossIncome) !== roundMoney(input.totalIncome - input.adjustments)) {
    findings.push({ severity: "error", code: "AGI_MISMATCH", message: "AGI does not equal total income less adjustments in the supplied worksheet." });
  }
  if (roundMoney(input.taxableIncome) !== Math.max(0, roundMoney(input.adjustedGrossIncome - input.deduction))) {
    findings.push({ severity: "error", code: "TAXABLE_INCOME_MISMATCH", message: "Taxable income does not reconcile to AGI less the supplied deduction." });
  }
  if (!input.taxpayerNamePresent) findings.push({ severity: "warning", code: "TAXPAYER_NAME_MISSING", message: "Taxpayer name presence has not been confirmed." });
  if (!input.taxpayerIdVerified) findings.push({ severity: "warning", code: "TAXPAYER_ID_UNVERIFIED", message: "Taxpayer identification has not been verified." });
  if (!input.requiredDocumentsComplete) findings.push({ severity: "warning", code: "DOCUMENTS_INCOMPLETE", message: "Required document completeness has not been confirmed." });
  return { findings, passed: findings.filter((item) => item.severity === "error").length === 0,
    reviewRequired: true as const, warning: "Consistency checks only; this does not establish tax-law compliance or return completeness." };
}
