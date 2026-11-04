# AEONCRM Database

Drizzle ORM + PostgreSQL persistence layer for AEONCRM.

The database package is the single persistence boundary for:

- Tenant and membership identity
- Companies, contacts and deals
- Leads, tickets, products and line items
- Activities and tasks
- Agent conversations, approvals and audit events
- Tax jurisdictions, versioned tax rules and immutable calculation snapshots

`src/schema.ts` is the application schema source of truth. `legacy-migrations/` preserves historical SQL from the pre-Drizzle migration path for upgrade/reference work; it is not executed by the current migration runner.

Tenant isolation is enforced in application queries and documented as a PostgreSQL defense-in-depth policy in `rls.sql`.
