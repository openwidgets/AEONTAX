import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, taxCalculation, taxRuleVersion } from "@aeoncrm/db";
import {
  calculateProgressiveTax,
  validateProgressiveRule,
  type ProgressiveTaxRule,
  type TaxCalculationInput,
  type TaxCalculationResult,
} from "@aeontax/tax";
import { assertIdentity, canApprove, type AeonIdentity } from "./identity";
import type { TenantContext } from "./agent-memory";
import { agentAuditService } from "./agent-audit";

function requireTenant(context: TenantContext): string {
  if (!context?.tenantId?.trim()) throw new Error("tenant context is required");
  return context.tenantId;
}

function ruleFromRecord(value: unknown): ProgressiveTaxRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("stored tax rule definition is invalid");
  }
  const rule = value as ProgressiveTaxRule;
  validateProgressiveRule(rule);
  return rule;
}

export type PublishTaxRuleInput = {
  rule: ProgressiveTaxRule;
  approvalReference: string;
  correlationId: string;
};

/**
 * Tenant-scoped persistence and execution boundary for tax rules.
 * Publishing requires an OWNER or ADMIN identity and a recorded approval
 * reference. Calculation only reads PUBLISHED rules effective on asOfDate.
 */
export const taxRuleService = {
  publish: async (identity: AeonIdentity, input: PublishTaxRuleInput) => {
    assertIdentity(identity);
    if (!canApprove(identity)) throw new Error("tax rule publication requires OWNER or ADMIN approval authority");
    if (!input.approvalReference?.trim()) throw new Error("approvalReference is required");
    if (!input.correlationId?.trim()) throw new Error("correlationId is required");
    if (input.rule.status !== "PUBLISHED") throw new Error("only a PUBLISHED rule can be published");
    validateProgressiveRule(input.rule);

    const tenantId = identity.tenantId;
    const rows = await db.insert(taxRuleVersion).values({
      id: randomUUID(),
      tenantId,
      jurisdictionCode: input.rule.jurisdiction,
      taxType: input.rule.taxType,
      taxYear: input.rule.taxYear,
      version: input.rule.version,
      status: "PUBLISHED",
      effectiveFrom: input.rule.effectiveFrom,
      effectiveTo: input.rule.effectiveTo,
      currency: input.rule.currency,
      ruleDefinition: structuredClone(input.rule),
      sourceEvidence: structuredClone(input.rule.source),
      createdBy: identity.userId,
      publishedAt: new Date(),
    }).returning();

    await agentAuditService.append(
      { tenantId, userId: identity.userId },
      {
        correlationId: input.correlationId,
        event: "APPROVED",
        tool: "tax.rules.publish",
        outcome: "published",
        metadata: {
          approvalReference: input.approvalReference,
          taxRuleVersionId: rows[0].id,
          jurisdiction: input.rule.jurisdiction,
          taxType: input.rule.taxType,
          taxYear: input.rule.taxYear,
          version: input.rule.version,
          source: input.rule.source,
        },
      },
    );
    return rows[0];
  },

  listPublished: async (context: TenantContext, filters?: {
    jurisdiction?: string;
    taxType?: string;
    taxYear?: string;
  }) => {
    const tenantId = requireTenant(context);
    const conditions = [
      eq(taxRuleVersion.tenantId, tenantId),
      eq(taxRuleVersion.status, "PUBLISHED"),
    ];
    if (filters?.jurisdiction) conditions.push(eq(taxRuleVersion.jurisdictionCode, filters.jurisdiction));
    if (filters?.taxType) conditions.push(eq(taxRuleVersion.taxType, filters.taxType));
    if (filters?.taxYear) conditions.push(eq(taxRuleVersion.taxYear, filters.taxYear));
    return db.select().from(taxRuleVersion)
      .where(and(...conditions))
      .orderBy(desc(taxRuleVersion.effectiveFrom), desc(taxRuleVersion.createdAt));
  },
};

export const taxCalculationService = {
  calculate: async (
    context: TenantContext,
    input: TaxCalculationInput,
  ): Promise<TaxCalculationResult> => {
    const tenantId = requireTenant(context);
    const candidates = await db.select().from(taxRuleVersion).where(and(
      eq(taxRuleVersion.tenantId, tenantId),
      eq(taxRuleVersion.jurisdictionCode, input.jurisdiction),
      eq(taxRuleVersion.taxType, input.taxType),
      eq(taxRuleVersion.taxYear, input.taxYear),
      eq(taxRuleVersion.status, "PUBLISHED"),
    )).orderBy(desc(taxRuleVersion.effectiveFrom));

    const effective = candidates.filter((record) =>
      record.effectiveFrom <= input.asOfDate &&
      (record.effectiveTo === null || record.effectiveTo >= input.asOfDate),
    );
    if (effective.length === 0) throw new Error("no published tax rule is effective for this jurisdiction, tax type, tax year and date");
    if (effective.length > 1) throw new Error("multiple published tax rules are effective; resolve the overlapping rule versions before calculating");

    const selected = effective[0];
    const rule = ruleFromRecord(selected.ruleDefinition);
    if (rule.version !== selected.version || rule.jurisdiction !== selected.jurisdictionCode ||
        rule.taxType !== selected.taxType || rule.taxYear !== selected.taxYear) {
      throw new Error("stored tax rule metadata does not match its indexed record");
    }

    const result = calculateProgressiveTax(rule, input);
    await db.insert(taxCalculation).values({
      id: result.calculationId,
      tenantId,
      taxpayerReference: input.taxpayerReference,
      jurisdictionCode: input.jurisdiction,
      taxType: input.taxType,
      taxYear: input.taxYear,
      ruleVersionId: selected.id,
      inputSnapshot: structuredClone(input),
      resultSnapshot: structuredClone(result),
      currency: result.currency,
      totalTaxMinor: result.totalTaxMinor,
      calculatedBy: context.userId,
    });
    return result;
  },

  listForTaxpayer: async (context: TenantContext, taxpayerReference: string, limit = 50) => {
    const tenantId = requireTenant(context);
    if (!taxpayerReference?.trim()) throw new Error("taxpayerReference is required");
    return db.select().from(taxCalculation).where(and(
      eq(taxCalculation.tenantId, tenantId),
      eq(taxCalculation.taxpayerReference, taxpayerReference),
    )).orderBy(desc(taxCalculation.calculatedAt)).limit(Math.min(Math.max(limit, 1), 200));
  },
};
