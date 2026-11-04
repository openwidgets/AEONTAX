import type { ProgressiveTaxRule } from "./types";
import { validateProgressiveRule } from "./calculator";

/**
 * In-memory immutable rule registry for service composition and local use.
 * A persistent, tenant-governed repository is a later integration step.
 * Re-registering the same jurisdiction/type/year/version is rejected.
 */
export class TaxRuleRegistry {
  private readonly rules = new Map<string, Readonly<ProgressiveTaxRule>>();

  private key(rule: Pick<ProgressiveTaxRule, "jurisdiction" | "taxType" | "taxYear" | "version">): string {
    return [rule.jurisdiction, rule.taxType, rule.taxYear, rule.version].map((part) => part.toUpperCase()).join(":");
  }

  register(rule: ProgressiveTaxRule): this {
    validateProgressiveRule(rule);
    const key = this.key(rule);
    if (this.rules.has(key)) throw new Error(`tax rule version already registered: ${key}`);
    const immutable = structuredClone(rule);
    this.rules.set(key, immutable);
    return this;
  }

  get(input: { jurisdiction: string; taxType: string; taxYear: string; version: string }): Readonly<ProgressiveTaxRule> | undefined {
    const rule = this.rules.get(this.key(input));
    return rule ? structuredClone(rule) : undefined;
  }

  list(): Readonly<ProgressiveTaxRule>[] {
    return [...this.rules.values()].map((rule) => structuredClone(rule));
  }
}
