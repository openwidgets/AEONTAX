# AEONTAX source-repository integration audit

Reviewed source branches on 2026-11-04:

- `openwidgets/oopsone:main`
- `openwidgets/oopstax:main`
- Destination: `openwidgets/AEONTAX:main`

## Decisions

### OOPSTAX: tax-domain workflows

The source tax operations module registers 91 MCP workflows. Its own README explicitly classifies substantial portions as in-memory worksheet aids, review checklists, or metadata-only scaffolds. It also states that it does not persist taxpayer records, perform OCR, calculate final federal tax liability, connect to e-file providers, query IRS status, or submit returns.

AEONTAX imports selected reusable logic into `packages/tax/src/workflows.ts`:

- Form 1040 income / AGI / taxable-income worksheet (no final liability)
- Business income worksheet
- Capital-gains worksheet
- Estimated-payment tracker
- Refund / balance arithmetic comparison against a supplied liability
- Income and withholding aggregation
- Tax-code reference matching
- User-entered-rate calculator worksheet
- Fiscal-year period matching
- Book-to-tax difference summary
- E-invoice status summary
- Withholding review flags
- VAT/GST arithmetic reconciliation
- Configured sales-tax nexus threshold screening
- Tax-provision worksheet
- Cross-border review-gap checklist
- Return worksheet consistency checks

These are separated from the published-rule progressive calculator. None is represented as a jurisdiction law engine. All continue to carry review limitations.

The remaining source workflows are not copied wholesale because many are metadata-only examples or local preview scaffolds. Their requirements can be implemented against AEONTAX persistence and authorization when the corresponding domain records and integrations exist.

### OOPSONE: platform foundation

OOPSONE's documented platform model is one account/application with Supabase Auth, membership RBAC, account-scoped data, RLS, audit, notifications, file metadata, webhooks, jobs, integrations, environments and operational health.

AEONTAX already uses a different stack: Next.js, Drizzle and PostgreSQL, with tenant-scoped CRM entities, `AeonIdentity`, OWNER/ADMIN authorization, persistent approvals, conversation memory and a hash-chained audit service.

Therefore the reusable design principles are retained, but the FastAPI/Supabase implementation is not copied into AEONTAX. Adding a second authentication provider, database client, or parallel tenant model would split the security boundary.

## Gaps retained for subsequent work

1. Generate and apply the Drizzle migration for `TaxJurisdiction`, `TaxRuleVersion`, and `TaxCalculation`.
2. Add tenant-scoped tax client, engagement, document metadata, consent and filing records.
3. Add secure document storage and upload scanning; do not store raw taxpayer documents in agent conversation memory.
4. Add integration connection records and secret references for approved tax software, e-file, accounting and authority providers.
5. Add durable background jobs, retries, idempotency and provider callbacks for external filing/status workflows.
6. Add jurisdiction-specific rule corpora with official citations, effective dates, reviewer approvals and golden test cases.
7. Add a tax-specific MCP/UI surface. The source OOPSTAX MCP route is a useful Apps SDK reference, but its complete widget catalog is not copied into AEONTAX.
8. Add CI execution of typecheck, unit tests, migration checks and tenant-isolation tests.

## Security and correctness notes

- Tax rule publication now requires an existing approved `tax.rules.publish` approval, matching correlation ID and matching approved rule payload.
- Calculation records and rule records are queried with the tenant ID.
- The imported worksheet functions do not persist input data.
- No US federal/state, India income-tax/GST or other jurisdiction rates are seeded by this integration.
- Do not treat a user-supplied rate, threshold, tax code or fiscal calendar as authoritative legal data.
