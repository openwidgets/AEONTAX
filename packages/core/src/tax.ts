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
import { agentApprovalService } from "./agent-memory";

function requireTenant(context: TenantContext): string {
  if (!context?.tenantId?.trim()) throw new Error("tenant context is required");
  return context.tenantId;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
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
  approvalId: string;
  correlationId: string;
};

/**
 * Tenant-scoped persistence and execution boundary for tax rules.
 * Publishing requires an OWNER or ADMIN identity and a verified approval
 * reference. Calculation only reads PUBLISHED rules effective on asOfDate.
 */
export const taxRuleService = {
  publish: async (identity: AeonIdentity, input: PublishTaxRuleInput) => {
    assertIdentity(identity);
    if (!canApprove(identity)) throw new Error("tax rule publication requires OWNER or ADMIN approval authority");
    if (!input.approvalId?.trim()) throw new Error("approvalId is required");
    if (!input.correlationId?.trim()) throw new Error("correlationId is required");
    if (input.rule.status !== "PUBLISHED") throw new Error("only a PUBLISHED rule can be published");
    validateProgressiveRule(input.rule);

    const tenantId = identity.tenantId;
    const approval = await agentApprovalService.get({ tenantId, userId: identity.userId }, input.approvalId);
    if (!approval || approval.status !== "APPROVED" || approval.tool !== "tax.rules.publish") {
      throw new Error("an approved tax.rules.publish approval is required");
    }
    if (approval.correlationId !== input.correlationId) throw new Error("approval correlation does not match");
    const approvedArguments = approval.arguments as { rule?: unknown } | null;
    if (!approvedArguments?.rule || canonicalJson(approvedArguments.rule) !== canonicalJson(input.rule)) {
      throw new Error("published tax rule does not match the approved rule payload");
    }
    await agentApprovalService.claimExecution({ tenantId, userId: identity.userId }, input.approvalId);
    try {
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
          event: "EXECUTED",
          tool: "tax.rules.publish",
          outcome: "published",
          metadata: {
            approvalId: input.approvalId,
            taxRuleVersionId: rows[0].id,
            jurisdiction: input.rule.jurisdiction,
            taxType: input.rule.taxType,
            taxYear: input.rule.taxYear,
            version: input.rule.version,
            source: input.rule.source,
          },
        },
      );
      await agentApprovalService.markExecuted({ tenantId, userId: identity.userId }, input.approvalId);
      return rows[0];

    } catch (error) {
      await agentApprovalService.releaseExecution({ tenantId, userId: identity.userId }, input.approvalId);
      throw error;
    }
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
