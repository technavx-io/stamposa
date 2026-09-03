import { AdminRole, PlatformAdmin } from '@prisma/client';

/** Token kinds used by the admin surface. */
export type AdminTokenType = 'admin_access' | 'admin_refresh' | 'admin_2fa';

export interface AdminJwtPayload {
  /** PlatformAdmin id. */
  sub: string;
  type: AdminTokenType;
  role: AdminRole;
  /** Session id — refresh tokens only, keyed in Redis for revocation. */
  jti?: string;
}

/** Resolved, DB-fresh admin attached to every authenticated admin request. */
export interface AdminActor {
  admin: PlatformAdmin;
}

/**
 * Role capability map. Kept as data (not scattered `if` statements) so the
 * permission model is auditable in one place and can move to the database
 * when custom roles ship.
 */
export const ADMIN_CAPABILITIES = {
  /** Read tenant lists and detail. */
  'merchants.read': ['SUPER_ADMIN', 'OPS', 'SUPPORT', 'FINANCE', 'ANALYST'],
  /** Edit operator-only fields (notes). */
  'merchants.write': ['SUPER_ADMIN', 'OPS'],
  /** Suspend / reactivate a tenant. */
  'merchants.suspend': ['SUPER_ADMIN', 'OPS'],
  /** Sign in as a merchant for support. */
  'merchants.impersonate': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  /** Look up an end customer by exact phone (PII, reason required). */
  'customers.lookup': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  /** Anonymise a customer's identity everywhere (DPDP/GDPR erasure). */
  'customers.erase': ['SUPER_ADMIN'],
  /** Read the audit log. */
  'audit.read': ['SUPER_ADMIN', 'OPS', 'SUPPORT', 'FINANCE', 'ANALYST'],
  /** Read tenant feedback (merchant / staff / customer). */
  'feedback.read': ['SUPER_ADMIN', 'OPS', 'SUPPORT', 'ANALYST'],
  /** Triage feedback (new / reviewed / resolved). */
  'feedback.manage': ['SUPER_ADMIN', 'OPS', 'SUPPORT'],
  /** Manage the platform's own team. */
  'team.manage': ['SUPER_ADMIN'],
  /** Read platform-wide operational health. */
  'platform.read': ['SUPER_ADMIN', 'OPS', 'ANALYST'],
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminCapability = keyof typeof ADMIN_CAPABILITIES;

export function roleHasCapability(role: AdminRole, capability: AdminCapability): boolean {
  return (ADMIN_CAPABILITIES[capability] as readonly AdminRole[]).includes(role);
}

/** Every capability a role holds — handy for the frontend to hide what it can't do. */
export function capabilitiesForRole(role: AdminRole): AdminCapability[] {
  return (Object.keys(ADMIN_CAPABILITIES) as AdminCapability[]).filter((c) =>
    roleHasCapability(role, c),
  );
}
