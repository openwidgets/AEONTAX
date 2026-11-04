-- AEONTAX tax domain foundation.
-- All records are tenant-scoped. This migration intentionally adds no seeded
-- rates or jurisdiction claims; rules must be sourced and reviewed first.

CREATE TYPE "TaxRuleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

CREATE TABLE "TaxJurisdiction" (
  "id" text PRIMARY KEY NOT NULL,
  "tenantId" text NOT NULL,
  "code" text NOT NULL,
  "countryCode" text NOT NULL,
  "level" text NOT NULL,
  "name" text NOT NULL,
  "authorityName" text,
  "authorityUrl" text,
  "implementationStatus" text DEFAULT 'NOT_STARTED' NOT NULL,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "TaxJurisdiction_tenantId_code_key" ON "TaxJurisdiction" ("tenantId", "code");
CREATE INDEX "TaxJurisdiction_tenantId_countryCode_idx" ON "TaxJurisdiction" ("tenantId", "countryCode");

CREATE TABLE "TaxRuleVersion" (
  "id" text PRIMARY KEY NOT NULL,
  "tenantId" text NOT NULL,
  "jurisdictionCode" text NOT NULL,
  "taxType" text NOT NULL,
  "taxYear" text NOT NULL,
  "version" text NOT NULL,
  "status" "TaxRuleStatus" DEFAULT 'DRAFT' NOT NULL,
  "effectiveFrom" text NOT NULL,
  "effectiveTo" text,
  "currency" text NOT NULL,
  "ruleDefinition" jsonb NOT NULL,
  "sourceEvidence" jsonb NOT NULL,
  "createdBy" text,
  "publishedAt" timestamptz,
  "createdAt" timestamptz DEFAULT now() NOT NULL,
  "updatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "TaxRuleVersion_tenant_rule_version_key" ON "TaxRuleVersion" ("tenantId", "jurisdictionCode", "taxType", "taxYear", "version");
CREATE INDEX "TaxRuleVersion_tenant_jurisdiction_year_status_idx" ON "TaxRuleVersion" ("tenantId", "jurisdictionCode", "taxYear", "status");

CREATE TABLE "TaxCalculation" (
  "id" text PRIMARY KEY NOT NULL,
  "tenantId" text NOT NULL,
  "taxpayerReference" text NOT NULL,
  "jurisdictionCode" text NOT NULL,
  "taxType" text NOT NULL,
  "taxYear" text NOT NULL,
  "ruleVersionId" text NOT NULL,
  "inputSnapshot" jsonb NOT NULL,
  "resultSnapshot" jsonb NOT NULL,
  "currency" text NOT NULL,
  "totalTaxMinor" text NOT NULL,
  "calculatedBy" text,
  "calculatedAt" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "TaxCalculation_tenant_taxpayer_date_idx" ON "TaxCalculation" ("tenantId", "taxpayerReference", "calculatedAt");
CREATE INDEX "TaxCalculation_tenant_jurisdiction_year_idx" ON "TaxCalculation" ("tenantId", "jurisdictionCode", "taxYear");
CREATE INDEX "TaxCalculation_tenant_ruleVersion_idx" ON "TaxCalculation" ("tenantId", "ruleVersionId");
