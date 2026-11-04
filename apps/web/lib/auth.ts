import type { AeonIdentity } from "@aeoncrm/core";

/**
 * Temporary development-only identity adapter.
 *
 * This is not an authentication provider. Production requests must be backed
 * by a verified session/OIDC integration and a tenant membership lookup.
 * Until that integration is installed, fail closed rather than granting a
 * shared SYSTEM identity to every request.
 */
export function getRequestIdentity(_request: Request): AeonIdentity {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Verified authentication is not configured; refusing to issue a production identity",
    );
  }

  const userId = process.env.AEON_SYSTEM_USER_ID;
  const tenantId = process.env.AEON_SYSTEM_TENANT_ID;

  if (!userId || !tenantId) {
    throw new Error("Development identity is not configured");
  }

  return {
    userId,
    tenantId,
    roles: ["SYSTEM"],
    email: undefined,
    name: undefined,
  };
}
