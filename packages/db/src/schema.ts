import { pgEnum, pgTable, text, integer, boolean, timestamp, numeric, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const dealStatus = pgEnum("DealStatus", ["OPEN", "WON", "LOST"]);
export const activityType = pgEnum("ActivityType", ["CALL", "EMAIL", "MEETING", "NOTE", "TASK"]);
export const taskStatus = pgEnum("TaskStatus", ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
export const agentConversationStatus = pgEnum("AgentConversationStatus", ["ACTIVE", "ARCHIVED"]);
export const agentMessageRole = pgEnum("AgentMessageRole", ["USER", "ASSISTANT", "TOOL", "SYSTEM"]);
export const agentApprovalStatus = pgEnum("AgentApprovalStatus", ["PENDING", "APPROVED", "REJECTED", "EXECUTING", "EXECUTED"]);
export const agentAuditEvent = pgEnum("AgentAuditEvent", ["PLANNED", "APPROVAL_REQUESTED", "APPROVED", "REJECTED", "EXECUTION_STARTED", "EXECUTED", "FAILED"]);
export const membershipRole = pgEnum("MembershipRole", ["OWNER", "ADMIN", "MEMBER"]);
export const leadStatus = pgEnum("LeadStatus", ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"]);
export const ticketStatus = pgEnum("TicketStatus", ["OPEN", "PENDING", "RESOLVED", "CLOSED"]);
export const ticketPriority = pgEnum("TicketPriority", ["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const taxRuleStatus = pgEnum("TaxRuleStatus", ["DRAFT", "PUBLISHED", "RETIRED"]);

const id = () => text().primaryKey().notNull();
const createdAt = () => timestamp("createdAt", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull();

export const tenant = pgTable("Tenant", {
  id: id(), name: text().notNull(), slug: text().notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [uniqueIndex("Tenant_slug_key").on(t.slug)]);

export const user = pgTable("User", {
  id: id(), email: text().notNull(), name: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [uniqueIndex("User_email_key").on(t.email)]);

export const membership = pgTable("Membership", {
  id: id(), userId: text().notNull(), tenantId: text().notNull(), role: membershipRole().default("MEMBER").notNull(), createdAt: createdAt(),
}, (t) => [uniqueIndex("Membership_userId_tenantId_key").on(t.userId, t.tenantId), index("Membership_tenantId_role_idx").on(t.tenantId, t.role)]);

export const company = pgTable("Company", {
  id: id(), tenantId: text().notNull(), name: text().notNull(), website: text(), industry: text(), description: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("Company_tenantId_name_idx").on(t.tenantId, t.name)]);

export const contact = pgTable("Contact", {
  id: id(), tenantId: text().notNull(), firstName: text().notNull(), lastName: text().notNull(), email: text(), phone: text(), title: text(), companyId: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("Contact_tenantId_email_idx").on(t.tenantId, t.email), index("Contact_tenantId_companyId_idx").on(t.tenantId, t.companyId)]);

export const lead = pgTable("Lead", {
  id: id(), tenantId: text().notNull(), firstName: text(), lastName: text(), companyName: text(), email: text(), phone: text(), title: text(), source: text(), status: leadStatus().default("NEW").notNull(), score: integer().default(0).notNull(), notes: text(), companyId: text(), contactId: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("Lead_tenantId_status_score_idx").on(t.tenantId, t.status, t.score), index("Lead_tenantId_email_idx").on(t.tenantId, t.email), index("Lead_tenantId_companyId_idx").on(t.tenantId, t.companyId)]);

export const deal = pgTable("Deal", {
  id: id(), tenantId: text().notNull(), name: text().notNull(), value: numeric({ precision: 18, scale: 2 }).notNull(), currency: text().default("INR").notNull(), stage: text().default("QUALIFICATION").notNull(), status: dealStatus().default("OPEN").notNull(), probability: integer().default(20).notNull(), expectedAt: timestamp("expectedAt", { withTimezone: true }), companyId: text(), contactId: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("Deal_tenantId_status_stage_idx").on(t.tenantId, t.status, t.stage), index("Deal_tenantId_companyId_idx").on(t.tenantId, t.companyId)]);

export const ticket = pgTable("Ticket", {
  id: id(), tenantId: text().notNull(), subject: text().notNull(), description: text(), status: ticketStatus().default("OPEN").notNull(), priority: ticketPriority().default("MEDIUM").notNull(), companyId: text(), contactId: text(), createdAt: createdAt(), updatedAt: updatedAt(), resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
}, (t) => [index("Ticket_tenantId_status_priority_idx").on(t.tenantId, t.status, t.priority), index("Ticket_tenantId_companyId_idx").on(t.tenantId, t.companyId), index("Ticket_tenantId_contactId_idx").on(t.tenantId, t.contactId)]);


export const taxRuleStatus = pgEnum("TaxRuleStatus", ["DRAFT", "PUBLISHED", "RETIRED"]);

export const taxJurisdiction = pgTable("TaxJurisdiction", {
  id: id(),
  tenantId: text().notNull(),
  code: text().notNull(),
  countryCode: text().notNull(),
  level: text().notNull(),
  name: text().notNull(),
  authorityName: text(),
  authorityUrl: text(),
  implementationStatus: text().default("NOT_STARTED").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("TaxJurisdiction_tenantId_code_key").on(t.tenantId, t.code),
  index("TaxJurisdiction_tenantId_countryCode_idx").on(t.tenantId, t.countryCode),
]);

export const taxRuleVersion = pgTable("TaxRuleVersion", {
  id: id(),
  tenantId: text().notNull(),
  jurisdictionCode: text().notNull(),
  taxType: text().notNull(),
  taxYear: text().notNull(),
  version: text().notNull(),
  status: taxRuleStatus().default("DRAFT").notNull(),
  effectiveFrom: text().notNull(),
  effectiveTo: text(),
  currency: text().notNull(),
  ruleDefinition: jsonb().notNull(),
  sourceEvidence: jsonb().notNull(),
  createdBy: text(),
  publishedAt: timestamp("publishedAt", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex("TaxRuleVersion_tenant_rule_version_key").on(t.tenantId, t.jurisdictionCode, t.taxType, t.taxYear, t.version),
  index("TaxRuleVersion_tenant_jurisdiction_year_status_idx").on(t.tenantId, t.jurisdictionCode, t.taxYear, t.status),
]);

export const taxCalculation = pgTable("TaxCalculation", {
  id: id(),
  tenantId: text().notNull(),
  taxpayerReference: text().notNull(),
  jurisdictionCode: text().notNull(),
  taxType: text().notNull(),
  taxYear: text().notNull(),
  ruleVersionId: text().notNull(),
  inputSnapshot: jsonb().notNull(),
  resultSnapshot: jsonb().notNull(),
  currency: text().notNull(),
  totalTaxMinor: text().notNull(),
  calculatedBy: text(),
  calculatedAt: createdAt(),
}, (t) => [
  index("TaxCalculation_tenant_taxpayer_date_idx").on(t.tenantId, t.taxpayerReference, t.calculatedAt),
  index("TaxCalculation_tenant_jurisdiction_year_idx").on(t.tenantId, t.jurisdictionCode, t.taxYear),
  index("TaxCalculation_tenant_ruleVersion_idx").on(t.tenantId, t.ruleVersionId),
]);

export const product = pgTable("Product", {
  id: id(), tenantId: text().notNull(), name: text().notNull(), sku: text(), description: text(), unitPrice: numeric({ precision: 18, scale: 2 }).notNull(), currency: text().default("INR").notNull(), active: boolean().default(true).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("Product_tenantId_name_idx").on(t.tenantId, t.name), index("Product_tenantId_sku_idx").on(t.tenantId, t.sku)]);

export const lineItem = pgTable("LineItem", {
  id: id(), tenantId: text().notNull(), dealId: text().notNull(), productId: text(), description: text(), quantity: numeric({ precision: 18, scale: 4 }).notNull(), unitPrice: numeric({ precision: 18, scale: 2 }).notNull(), discount: numeric({ precision: 5, scale: 2 }).default("0").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("LineItem_tenantId_dealId_idx").on(t.tenantId, t.dealId), index("LineItem_tenantId_productId_idx").on(t.tenantId, t.productId)]);

export const activity = pgTable("Activity", {
  id: id(), tenantId: text().notNull(), type: activityType().notNull(), subject: text().notNull(), body: text(), occurredAt: timestamp("occurredAt", { withTimezone: true }).defaultNow().notNull(), companyId: text(), contactId: text(), dealId: text(),
}, (t) => [index("Activity_tenantId_occurredAt_idx").on(t.tenantId, t.occurredAt), index("Activity_tenantId_dealId_idx").on(t.tenantId, t.dealId)]);

export const task = pgTable("Task", {
  id: id(), tenantId: text().notNull(), title: text().notNull(), description: text(), status: taskStatus().default("TODO").notNull(), dueAt: timestamp("dueAt", { withTimezone: true }), companyId: text(), contactId: text(), dealId: text(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("Task_tenantId_status_dueAt_idx").on(t.tenantId, t.status, t.dueAt)]);

export const agentConversation = pgTable("AgentConversation", {
  id: id(), tenantId: text().notNull(), title: text().default("New conversation").notNull(), status: agentConversationStatus().default("ACTIVE").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [index("AgentConversation_tenantId_status_updatedAt_idx").on(t.tenantId, t.status, t.updatedAt)]);

export const agentMessage = pgTable("AgentMessage", {
  id: id(), conversationId: text().notNull(), userId: text(), role: agentMessageRole().notNull(), content: text().notNull(), intent: text(), tool: text(), requiresApproval: boolean().default(false).notNull(), approved: boolean().default(false).notNull(), metadata: jsonb(), createdAt: createdAt(),
}, (t) => [index("AgentMessage_conversationId_createdAt_idx").on(t.conversationId, t.createdAt), index("AgentMessage_userId_createdAt_idx").on(t.userId, t.createdAt)]);

export const agentApproval = pgTable("AgentApproval", {
  id: id(), tenantId: text().notNull(), conversationId: text().notNull(), messageId: text().notNull(), correlationId: text().notNull(), tool: text().notNull(), arguments: jsonb().notNull(), status: agentApprovalStatus().default("PENDING").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (t) => [uniqueIndex("AgentApproval_messageId_key").on(t.messageId), index("AgentApproval_tenantId_status_idx").on(t.tenantId, t.status), index("AgentApproval_conversationId_status_idx").on(t.conversationId, t.status), index("AgentApproval_tenantId_correlationId_idx").on(t.tenantId, t.correlationId)]);

export const agentAuditEventRecord = pgTable("AgentAuditEventRecord", {
  id: id(), tenantId: text().notNull(), userId: text(), correlationId: text().notNull(), event: agentAuditEvent().notNull(), tool: text(), outcome: text(), metadata: jsonb(), previousHash: text(), eventHash: text().notNull(), createdAt: createdAt(),
}, (t) => [uniqueIndex("AgentAuditEventRecord_tenantId_eventHash_key").on(t.tenantId, t.eventHash), index("AgentAuditEventRecord_tenantId_createdAt_idx").on(t.tenantId, t.createdAt), index("AgentAuditEventRecord_tenantId_correlationId_createdAt_idx").on(t.tenantId, t.correlationId, t.createdAt), index("AgentAuditEventRecord_tenantId_event_idx").on(t.tenantId, t.event)]);

export type Tenant = typeof tenant.$inferSelect;
export type User = typeof user.$inferSelect;
export type Membership = typeof membership.$inferSelect;
export type Company = typeof company.$inferSelect;
export type Contact = typeof contact.$inferSelect;
export type Lead = typeof lead.$inferSelect;
export type Deal = typeof deal.$inferSelect;
export type Ticket = typeof ticket.$inferSelect;
export type TaxJurisdiction = typeof taxJurisdiction.$inferSelect;
export type TaxRuleVersion = typeof taxRuleVersion.$inferSelect;
export type TaxCalculation = typeof taxCalculation.$inferSelect;
export type Product = typeof product.$inferSelect;
export type LineItem = typeof lineItem.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type Task = typeof task.$inferSelect;
export type AgentConversation = typeof agentConversation.$inferSelect;
export type AgentMessage = typeof agentMessage.$inferSelect;
export type AgentApproval = typeof agentApproval.$inferSelect;
export type AgentAuditEventRecord = typeof agentAuditEventRecord.$inferSelect;
