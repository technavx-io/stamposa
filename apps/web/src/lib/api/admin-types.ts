/**
 * Admin API contract types — mirrors the NestJS admin DTOs. The admin
 * surface is deliberately separate from tenant types: different credential
 * family, different shapes, no accidental sharing.
 */

export type AdminRole = 'SUPER_ADMIN' | 'OPS' | 'SUPPORT' | 'FINANCE' | 'ANALYST';

export type AdminCapability =
  | 'merchants.read'
  | 'merchants.write'
  | 'merchants.suspend'
  | 'merchants.impersonate'
  | 'customers.lookup'
  | 'customers.erase'
  | 'audit.read'
  | 'team.manage'
  | 'platform.read';

export interface AdminTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSec: number;
}

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  capabilities: AdminCapability[];
  twoFactorEnabled: boolean;
  recoveryCodesRemaining: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface AdminLoginResult {
  status: 'TWO_FACTOR_REQUIRED' | 'TWO_FACTOR_SETUP_REQUIRED';
  twoFactorToken: string;
  twoFactorSetup?: TwoFactorSetup;
}

export interface AdminSession {
  status: 'AUTHENTICATED';
  tokens: AdminTokens;
  admin: AdminProfile;
  recoveryCodes?: string[];
}

// ── Dashboard ───────────────────────────────────────────────────────────

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  title: string;
  detail: string;
  href: string;
  count?: number;
}

export interface AdminDashboard {
  stats: {
    merchants: number;
    activeMerchants: number;
    suspendedMerchants: number;
    newMerchants30d: number;
    customers: number;
    stampsTotal: number;
    stampsToday: number;
    stamps7d: number;
    stampsTrendPct: number;
    pendingRewards: number;
  };
  attention: AttentionItem[];
  recentSignups: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    suspended: boolean;
  }[];
  recentActivity: {
    id: string;
    action: string;
    actorLabel: string;
    targetLabel: string | null;
    reason: string | null;
    createdAt: string;
  }[];
}

// ── Merchants ───────────────────────────────────────────────────────────

export type HealthGrade = 'A' | 'B' | 'C' | 'D';
export type MerchantFilter = 'all' | 'active' | 'silent' | 'suspended' | 'no-campaign';

export interface AdminMerchantRow {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  ownerName: string;
  ownerPhone: string;
  campaignName: string | null;
  campaignStatus: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | null;
  customers: number;
  staff: number;
  stamps7d: number;
  health: HealthGrade;
  healthReason: string;
  suspended: boolean;
  suspendedReason: string | null;
  createdAt: string;
}

export interface AdminMerchantDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  joinUrl: string;
  adminNotes: string | null;
  owner: { id: string; name: string; phone: string; joinedAt: string };
  suspended: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  suspendedBy: string | null;
  health: HealthGrade;
  healthReason: string;
  stats: {
    customers: number;
    staff: number;
    stampsTotal: number;
    stamps7d: number;
    stampsPrev7d: number;
    pendingRewards: number;
    redeemedRewards: number;
    lastStampAt: string | null;
  };
  campaigns: {
    id: string;
    name: string;
    description: string | null;
    stampsRequired: number;
    reward: string;
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    members: number;
    createdAt: string;
  }[];
  staff: {
    id: string;
    name: string;
    phone: string;
    isActive: boolean;
    stampsIssued: number;
    createdAt: string;
  }[];
  createdAt: string;
}

export interface AdminTenantCustomer {
  id: string;
  code: string;
  name: string | null;
  stampCount: number;
  completedCount: number;
  totalStamps: number;
  lastStampAt: string | null;
  joinedAt: string;
}

export interface ImpersonationResult {
  sessionId: string;
  expiresAt: string;
  businessName: string;
  ownerName: string;
  tokens: { accessToken: string; refreshToken: string; accessTokenExpiresInSec: number };
}

// ── Customer lookup ─────────────────────────────────────────────────────

export interface CustomerLookupResult {
  found: boolean;
  customer: {
    id: string;
    name: string | null;
    phone: string;
    erasedAt: string | null;
    joinedAt: string;
    memberships: {
      id: string;
      code: string;
      businessId: string;
      businessName: string;
      campaignName: string;
      totalStamps: number;
      completedCount: number;
      joinedAt: string;
    }[];
  } | null;
}

// ── Audit ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  actorType: 'ADMIN' | 'MERCHANT' | 'STAFF' | 'SYSTEM';
  actorLabel: string;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  businessId: string | null;
  businessName: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ── Team ────────────────────────────────────────────────────────────────

export interface AdminTeamMember {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  activeSessions: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateAdminResult {
  admin: AdminTeamMember;
  temporaryPassword: string;
}

// ── Health ──────────────────────────────────────────────────────────────

export interface AdminHealth {
  services: { name: string; status: 'up' | 'down'; detail: string }[];
  counters: {
    businesses: number;
    customers: number;
    stamps: number;
    redemptions: number;
    auditEntries: number;
  };
  nodeVersion: string;
  environment: string;
}
