# AEONTAX

**The Agentic Tax Operating System**

AEONTAX is being built on the existing AEONCRM foundation. The CRM foundation remains available for relationships, clients, engagements, tasks, approvals, agent memory and audit; AEONTAX adds jurisdiction-aware tax rules, deterministic calculations, tax preparation workflows and tax operations.

## Product direction

- One governed platform for tax clients, preparers, reviewers and administrators
- Deterministic, versioned tax calculations with source evidence and effective dates
- Jurisdiction registry and tax-year rule publication
- Tax preparation worksheets and reconciliation workflows
- Tenant-scoped calculation history and audit records
- Agent-assisted workflows with approval gates for consequential actions
- Web/API surface, with a tax-specific MCP and ChatGPT Apps SDK surface planned

## Existing CRM foundation

The existing AEONCRM implementation is preserved:

- Companies, contacts, leads, deals, tasks and activities
- Tenant identity and role authorization
- Agent conversations, approvals and memory
- Hash-chained audit events
- Governed tool registry and CRM workspace

## Tax foundation

- `packages/tax`: rule contracts, progressive calculator, immutable in-memory rule registry and imported tax review workflows
- `packages/core/src/tax.ts`: tenant-scoped rule publication and calculation services
- `packages/db/src/schema.ts`: tenant-scoped tax jurisdiction, rule-version and calculation tables
- `packages/tax/src/workflows.ts`: selected preparation, reconciliation, indirect-tax and cross-border worksheet functions

## Important correctness boundary

The progressive calculator executes only published, source-backed rules supplied to it. The repository currently contains no seeded country or state tax rates, tax brackets, deductions, credits, filing rules or official authority integrations. Imported worksheet functions are review aids, not legal determinations or completed tax engines.

No US federal/state or India income-tax/GST engine should be considered complete until its rule corpus has official source citations, effective dates, independent review and golden test cases.

## Architecture

```text
                       AEONTAX
                          |
              +-----------+-----------+
              |                       |
          Tax workspace           AEON Agent
              |                       |
              +-----------+-----------+
                          |
                  Governed core
                          |
          +---------------+----------------+
          |               |                |
      Tax engine       CRM foundation   Audit / approvals
          |               |                |
          +---------------+----------------+
                          |
                 PostgreSQL / Drizzle
```

## Technology

- Next.js + TypeScript
- PostgreSQL + Drizzle ORM
- Workspace packages for core, agent, database and tax engine
- Tenant-scoped application services
- Vitest test foundation

## Repository structure

```text
apps/web                 Web application
packages/core            CRM and tax application services
packages/agent           Agent runtime, planning and memory
packages/db              Drizzle schema and database access
packages/tax             Deterministic tax engine and review workflows
docs                     Architecture, roadmap and integration decisions
```

## Source integrations

See [docs/SOURCE_REPOSITORY_INTEGRATION.md](docs/SOURCE_REPOSITORY_INTEGRATION.md) for the code review and selective integration decisions from `openwidgets/oopsone` and `openwidgets/oopstax`.

## Current status

**Foundation phase.** Tax-domain contracts, progressive calculation primitives, tenant-scoped persistence services and selected review workflows have been added. Database migration generation, jurisdiction rule corpora, document security, provider integrations, tax-specific UI/MCP and production validation remain outstanding.
