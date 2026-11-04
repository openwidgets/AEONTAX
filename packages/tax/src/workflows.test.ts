import { describe, expect, it } from "vitest";
import {
  calculateForm1040Worksheet, calculateUserRateWorksheet, compareRefundBalance,
  reconcileVatGst, reviewCrossBorderPayments, screenSalesTaxNexus, summarizeCapitalGains,
} from "./workflows";

describe("imported tax review workflows", () => {
  it("keeps Form 1040 worksheet separate from final tax liability", () => {
    const result = calculateForm1040Worksheet({ wages: 100000, adjustments: 5000, deduction: 10000, withholding: 12000 });
    expect(result.totalIncome).toBe(100000);
    expect(result.adjustedGrossIncome).toBe(95000);
    expect(result.taxableIncome).toBe(85000);
    expect(result.estimatedTaxLiability).toBeNull();
    expect(result.refundOrBalanceDue).toBeNull();
  });

  it("marks user-entered rate calculations as worksheets", () => {
    const result = calculateUserRateWorksheet({ taxableBase: 1000, ratePercent: 10, exemptAmount: 100, creditAmount: 20 });
    expect(result.calculatedTax).toBe(90);
    expect(result.netTaxAfterCredits).toBe(70);
    expect(result.reviewRequired).toBe(true);
  });

  it("compares supplied payments without deciding liability", () => {
    const result = compareRefundBalance({ estimatedTaxLiability: 100, withholding: 70, estimatedPayments: 20 });
    expect(result.estimatedBalanceDue).toBe(10);
    expect(result.estimatedRefund).toBe(0);
  });

  it("reconciles VAT/GST arithmetic using eligible input tax only", () => {
    const result = reconcileVatGst({ outputTax: 100, inputTaxClaimed: 60, inputTaxEligible: 40, reportedNetTax: 60 });
    expect(result.computedNetTax).toBe(60);
    expect(result.withinTolerance).toBe(true);
  });

  it("flags potential nexus registration gaps without making a legal determination", () => {
    const result = screenSalesTaxNexus([{ code: "ST-1", salesAmount: 120000, transactionCount: 10, salesThreshold: 100000, transactionThreshold: 200, physicalPresence: false, registered: false }]);
    expect(result.possibleRegistrationGaps).toEqual(["ST-1"]);
  });

  it("calculates capital gain worksheet totals by holding period", () => {
    const result = summarizeCapitalGains({ transactions: [{ description: "Asset A", proceeds: 1000, basis: 700, fees: 10, holdingPeriod: "long_term" }] });
    expect(result.longTermNet).toBe(290);
    expect(result.shortTermNet).toBe(0);
  });

  it("flags cross-border payments for specialist review", () => {
    const result = reviewCrossBorderPayments([{ reference: "P-1", payerJurisdiction: "A", payeeJurisdiction: "B", paymentType: "royalty", grossAmount: 500, withholdingReviewed: false, treatyDocumentationReviewed: false, indirectTaxReviewed: true, permanentEstablishmentReviewed: false }]);
    expect(result.needsSpecialistReview[0].reviewGaps).toContain("treaty_documentation_review");
  });
});
