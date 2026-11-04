import { eq, and } from "drizzle-orm";
import { db, membership, user } from "@aeoncrm/db";

export type AeonIdentity = {
  userId: string;
  tenantId: string;
  email?: string;
  name?: string;
  roles: string[];
};

/**
 * Input must come from a cryptographically verified authentication session.
 * Never pass raw request headers, query parameters, or unverified JWT claims.
 */
export type VerifiedPrincipal = {
  userId: string;
  tenantId: string;
};

const APPROVAL_ROLES = new Set(["OWNER", "ADMIN"]);

export function assertIdentity(identity: AeonIdentity): AeonIdentity {
  if (!identity.userId?.trim()) throw new Error("identity.userId is required");
  if (!identity.tenantId?.trim()) throw new Error("identity.tenantId is required");
  if (!Array.isArray(identity.roles) || identity.roles.length === 0) {
    throw new Error("identity.roles are required");
  }
  return identity;
}

/**
 * Converts a verified principal into an application identity only when both
 * the user and the requested tenant membership exist in PostgreSQL.
 * Roles are always sourced from Membership, never from client claims.
 */
export async function resolveTenantIdentity(
  principal: VerifiedPrincipal,
): Promise<AeonIdentity> {
  if (!principal?.userId?.trim()) throw new Error("verified principal userId is required");
  if (!principal?.tenantId?.trim()) throw new Error("verified principal tenantId is required");

  const rows = await db
    .select({
      userId: user.id,
      tenantId: membership.tenantId,
      email: user.email,
      name: user.name,
      role: membership.role,
    })
    .from(membership)
    .innerJoin(user, eq(membership.userId, user.id))
    .where(and(
      eq(membership.userId, principal.userId),
      eq(membership.tenantId, principal.tenantId),
    ))
    .limit(1);

  const row = rows[0];
  if (!row) throw new Error("user is not a member of the requested tenant");

  return assertIdentity({
    userId: row.userId,
    tenantId: row.tenantId,
    email: row.email,
    name: row.name ?? undefined,
    roles: [row.role],
  });
}

export function canApprove(identity: AeonIdentity): boolean {
  return identity.roles.some((role) => APPROVAL_ROLES.has(role.trim().toUpperCase()));
}
