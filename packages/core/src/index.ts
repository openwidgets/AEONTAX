import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { activity, company, contact, db, deal, lead, lineItem, product, task, ticket } from "@aeoncrm/db";
import { tenantCrm } from "./crm-tenant";
import type { TenantContext } from "./agent-memory";

export type DealStage = "LEAD" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
export type CreateActivityInput = { type: "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE"; subject: string; notes?: string; occurredAt?: Date; companyId?: string; contactId?: string; dealId?: string };
export type CreateTaskInput = { title: string; notes?: string; dueAt?: Date; companyId?: string; contactId?: string; dealId?: string };

export const companyService = {
  list: async (c: TenantContext) => { const tenantId = tenantCrm.tenant(c); return db.select().from(company).where(eq(company.tenantId, tenantId)).orderBy(desc(company.updatedAt)); },
  get: async (c: TenantContext, id: string) => {
    const tenantId = tenantCrm.tenant(c); const row = (await db.select().from(company).where(and(eq(company.id, id), eq(company.tenantId, tenantId))).limit(1))[0]; if (!row) return undefined;
    const [contacts, deals, activities, tasks] = await Promise.all([db.select().from(contact).where(and(eq(contact.tenantId, tenantId), eq(contact.companyId, id))), db.select().from(deal).where(and(eq(deal.tenantId, tenantId), eq(deal.companyId, id))), db.select().from(activity).where(and(eq(activity.tenantId, tenantId), eq(activity.companyId, id))).orderBy(desc(activity.occurredAt)), db.select().from(task).where(and(eq(task.tenantId, tenantId), eq(task.companyId, id))).orderBy(desc(task.createdAt))]);
    return { ...row, contacts, deals, activities, tasks };
  },
  create: async (c: TenantContext, input: { name: string; website?: string; industry?: string; description?: string }) => { const rows = await db.insert(company).values({ id: randomUUID(), ...input, tenantId: tenantCrm.tenant(c) }).returning(); return rows[0]; },
};

export const contactService = {
  list: async (c: TenantContext) => { const tenantId = tenantCrm.tenant(c); return db.select().from(contact).where(eq(contact.tenantId, tenantId)).orderBy(desc(contact.updatedAt)); },
  get: async (c: TenantContext, id: string) => { const tenantId = tenantCrm.tenant(c); const row = (await db.select().from(contact).where(and(eq(contact.id, id), eq(contact.tenantId, tenantId))).limit(1))[0]; if (!row) return undefined; const companyRow = row.companyId ? (await db.select().from(company).where(eq(company.id, row.companyId)).limit(1))[0] : undefined; return { ...row, company: companyRow }; },
  create: async (c: TenantContext, input: { firstName: string; lastName: string; email?: string; phone?: string; title?: string; companyId?: string }) => { await tenantCrm.company(c, input.companyId); const rows = await db.insert(contact).values({ id: randomUUID(), ...input, tenantId: tenantCrm.tenant(c) }).returning(); return rows[0]; },
};

export const leadService = {
  list: async (c: TenantContext) => { const tenantId = tenantCrm.tenant(c); return db.select().from(lead).where(eq(lead.tenantId, tenantId)).orderBy(desc(lead.score), desc(lead.updatedAt)); },
  get: async (c: TenantContext, id: string) => { const tenantId = tenantCrm.tenant(c); return (await db.select().from(lead).where(and(eq(lead.id, id), eq(lead.tenantId, tenantId))).limit(1))[0]; },
  create: async (c: TenantContext, input: { firstName?: string; lastName?: string; companyName?: string; email?: string; phone?: string; title?: string; source?: string; score?: number; notes?: string; companyId?: string; contactId?: string }) => { await tenantCrm.company(c, input.companyId); await tenantCrm.contact(c, input.contactId); const rows = await db.insert(lead).values({ id: randomUUID(), ...input, tenantId: tenantCrm.tenant(c) }).returning(); return rows[0]; },
  updateStatus: async (c: TenantContext, id: string, status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST") => db.update(lead).set({ status, updatedAt: new Date() }).where(and(eq(lead.id, id), eq(lead.tenantId, tenantCrm.tenant(c)))).returning({ id: lead.id }),
};

export const dealService = {
  list: async (c: TenantContext) => { const tenantId = tenantCrm.tenant(c); return db.select().from(deal).where(eq(deal.tenantId, tenantId)).orderBy(desc(deal.updatedAt)); },
  get: async (c: TenantContext, id: string) => { const tenantId = tenantCrm.tenant(c); return (await db.select().from(deal).where(and(eq(deal.id, id), eq(deal.tenantId, tenantId))).limit(1))[0]; },
  create: async (c: TenantContext, input: { name: string; value?: number; currency?: string; stage?: DealStage; probability?: number; companyId?: string; contactId?: string }) => { await tenantCrm.company(c, input.companyId); await tenantCrm.contact(c, input.contactId); const rows = await db.insert(deal).values({ id: randomUUID(), tenantId: tenantCrm.tenant(c), name: input.name, value: String(input.value ?? 0), currency: input.currency ?? "INR", stage: input.stage ?? "QUALIFICATION", probability: input.probability ?? 20, companyId: input.companyId, contactId: input.contactId }).returning(); return rows[0]; },
  updateStage: async (c: TenantContext, id: string, stage: DealStage) => db.update(deal).set({ stage, updatedAt: new Date() }).where(and(eq(deal.id, id), eq(deal.tenantId, tenantCrm.tenant(c)))).returning({ id: deal.id }),
};

export const ticketService = {
  list: async (c: TenantContext) => { const tenantId = tenantCrm.tenant(c); return db.select().from(ticket).where(eq(ticket.tenantId, tenantId)).orderBy(desc(ticket.updatedAt)); },
  get: async (c: TenantContext, id: string) => { const tenantId = tenantCrm.tenant(c); return (await db.select().from(ticket).where(and(eq(ticket.id, id), eq(ticket.tenantId, tenantId))).limit(1))[0]; },
  create: async (c: TenantContext, input: { subject: string; description?: string; priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; companyId?: string; contactId?: string }) => { await tenantCrm.company(c, input.companyId); await tenantCrm.contact(c, input.contactId); const rows = await db.insert(ticket).values({ id: randomUUID(), tenantId: tenantCrm.tenant(c), ...input }).returning(); return rows[0]; },
  updateStatus: async (c: TenantContext, id: string, status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED") => db.update(ticket).set({ status, resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : null, updatedAt: new Date() }).where(and(eq(ticket.id, id), eq(ticket.tenantId, tenantCrm.tenant(c)))).returning({ id: ticket.id }),
};

export const productService = {
  list: async (c: TenantContext) => db.select().from(product).where(eq(product.tenantId, tenantCrm.tenant(c))).orderBy(desc(product.active), asc(product.name)),
  get: async (c: TenantContext, id: string) => (await db.select().from(product).where(and(eq(product.id, id), eq(product.tenantId, tenantCrm.tenant(c)))).limit(1))[0],
  create: async (c: TenantContext, input: { name: string; sku?: string; description?: string; unitPrice: number; currency?: string; active?: boolean }) => { const rows = await db.insert(product).values({ id: randomUUID(), tenantId: tenantCrm.tenant(c), ...input, unitPrice: String(input.unitPrice) }).returning(); return rows[0]; },
};

export const lineItemService = {
  listForDeal: async (c: TenantContext, dealId: string) => { await tenantCrm.deal(c, dealId); return db.select().from(lineItem).where(and(eq(lineItem.tenantId, tenantCrm.tenant(c)), eq(lineItem.dealId, dealId))).orderBy(asc(lineItem.createdAt)); },
  create: async (c: TenantContext, input: { dealId: string; productId?: string; description?: string; quantity: number; unitPrice: number; discount?: number }) => { await tenantCrm.deal(c, input.dealId); await tenantCrm.product(c, input.productId); const rows = await db.insert(lineItem).values({ id: randomUUID(), tenantId: tenantCrm.tenant(c), ...input, quantity: String(input.quantity), unitPrice: String(input.unitPrice), discount: String(input.discount ?? 0) }).returning(); return rows[0]; },
};

export const activityService = {
  listRecent: async (c: TenantContext, limit = 50) => db.select().from(activity).where(eq(activity.tenantId, tenantCrm.tenant(c))).orderBy(desc(activity.occurredAt)).limit(Math.min(Math.max(limit, 1), 200)),
  create: async (c: TenantContext, input: CreateActivityInput) => { await tenantCrm.company(c, input.companyId); await tenantCrm.contact(c, input.contactId); await tenantCrm.deal(c, input.dealId); const rows = await db.insert(activity).values({ id: randomUUID(), tenantId: tenantCrm.tenant(c), type: input.type, subject: input.subject, body: input.notes, occurredAt: input.occurredAt ?? new Date(), companyId: input.companyId, contactId: input.contactId, dealId: input.dealId }).returning(); return rows[0]; },
};

export const taskService = {
  listOpen: async (c: TenantContext) => db.select().from(task).where(and(eq(task.tenantId, tenantCrm.tenant(c)), inArray(task.status, ["TODO", "IN_PROGRESS"]))).orderBy(asc(task.dueAt), desc(task.createdAt)),
  create: async (c: TenantContext, input: CreateTaskInput) => { await tenantCrm.company(c, input.companyId); await tenantCrm.contact(c, input.contactId); await tenantCrm.deal(c, input.dealId); const rows = await db.insert(task).values({ id: randomUUID(), tenantId: tenantCrm.tenant(c), title: input.title, description: input.notes, dueAt: input.dueAt, companyId: input.companyId, contactId: input.contactId, dealId: input.dealId }).returning(); return rows[0]; },
  complete: async (c: TenantContext, id: string) => db.update(task).set({ status: "DONE", updatedAt: new Date() }).where(and(eq(task.id, id), eq(task.tenantId, tenantCrm.tenant(c)))).returning({ id: task.id }),
};

export const dashboardService = {
  async summary(c: TenantContext) {
    const tenantId = tenantCrm.tenant(c);
    const [companies, contacts, leads, tickets, openDeals, wonDeals, openTasks, followUps] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(company).where(eq(company.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)` }).from(contact).where(eq(contact.tenantId, tenantId)),
      db.select({ count: sql<number>`count(*)` }).from(lead).where(and(eq(lead.tenantId, tenantId), inArray(lead.status, ["NEW", "CONTACTED", "QUALIFIED"]))),
      db.select({ count: sql<number>`count(*)` }).from(ticket).where(and(eq(ticket.tenantId, tenantId), inArray(ticket.status, ["OPEN", "PENDING"]))),
      db.select({ count: sql<number>`count(*)`, sum: sql<string>`coalesce(sum(${deal.value}), 0)` }).from(deal).where(and(eq(deal.tenantId, tenantId), eq(deal.status, "OPEN"))),
      db.select({ count: sql<number>`count(*)`, sum: sql<string>`coalesce(sum(${deal.value}), 0)` }).from(deal).where(and(eq(deal.tenantId, tenantId), eq(deal.status, "WON"))),
      db.select({ count: sql<number>`count(*)` }).from(task).where(and(eq(task.tenantId, tenantId), inArray(task.status, ["TODO", "IN_PROGRESS"]))),
      db.select({ count: sql<number>`count(*)` }).from(task).where(and(eq(task.tenantId, tenantId), inArray(task.status, ["TODO", "IN_PROGRESS"]), sql`${task.dueAt} is not null`)),
    ]);
    return { companies: Number(companies[0]?.count ?? 0), contacts: Number(contacts[0]?.count ?? 0), leads: Number(leads[0]?.count ?? 0), tickets: Number(tickets[0]?.count ?? 0), openDeals: Number(openDeals[0]?.count ?? 0), openPipelineValue: Number(openDeals[0]?.sum ?? 0), wonDeals: Number(wonDeals[0]?.count ?? 0), wonRevenue: Number(wonDeals[0]?.sum ?? 0), openTasks: Number(openTasks[0]?.count ?? 0), followUps: Number(followUps[0]?.count ?? 0) };
  },
};

export { assertIdentity, canApprove } from "./identity";
export type { AeonIdentity } from "./identity";
export { agentConversationService, agentMessageService, agentApprovalService } from "./agent-memory";
export type { TenantContext } from "./agent-memory";
export { agentAuditService } from "./agent-audit";
export type { AgentAuditInput } from "./agent-audit";
export { ToolRegistry, createDefaultToolRegistry } from "./tool-registry";
export type { GovernedTool, ToolAccess, ToolRisk } from "./tool-registry";

export { taxRuleService, taxCalculationService } from "./tax";
export type { PublishTaxRuleInput } from "./tax";

export * from "@aeontax/tax";
