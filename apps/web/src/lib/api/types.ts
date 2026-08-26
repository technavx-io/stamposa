/**
 * API contract types — mirrors the NestJS response DTOs
 * (apps/api/src/[module]/dto). Keep the two in sync when the API changes.
 */

export type ActorRole = 'MERCHANT' | 'STAFF' | 'CUSTOMER';
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type StampIssuerType = 'STAFF' | 'MERCHANT' | 'ADJUSTMENT';
export type RedemptionStatus = 'PENDING' | 'REDEEMED' | 'VOID';
export type StaffRole = 'STAFF' | 'MANAGER';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  retryAfterSec?: number;
  requestId?: string;
  path: string;
  timestamp: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Auth ────────────────────────────────────────────────────────────────

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSec: number;
}

export interface SessionActor {
  id: string;
  role: ActorRole;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface AuthSession {
  tokens: Tokens;
  actor: SessionActor;
  business: Business | null;
}

export interface OtpRequested {
  expiresInSec: number;
  resendInSec: number;
  devCode?: string;
}

export interface EmailVerificationRequested {
  verificationRequired: true;
  email: string;
  expiresInSec: number;
  resendInSec: number;
  devCode?: string;
}

export interface AuthResult {
  status: 'AUTHENTICATED' | 'REGISTRATION_REQUIRED';
  session: AuthSession | null;
  registrationToken: string | null;
}

export interface ImpersonationInfo {
  sessionId: string;
  adminLabel: string;
  expiresAt: string;
}

export interface Me {
  role: ActorRole;
  actor: SessionActor;
  business: Business | null;
  /** Set when this session is an admin impersonating the merchant. */
  impersonation?: ImpersonationInfo | null;
}

// ── Business / campaigns / staff ────────────────────────────────────────

export interface Business {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  joinUrl: string;
  brandColor: string | null;
  category: string | null;
  timezone: string;
  consentText: string | null;
  notifyDailySummary: boolean;
  notifyWeeklyDigest: boolean;
  notifyStaffInactive: boolean;
  suspended: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  stampsRequired: number;
  reward: string;
  status: CampaignStatus;
  dailyStampCap: number | null;
  terms: string | null;
  memberCount: number;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole;
  isActive: boolean;
  stampsIssued: number;
  createdAt: string;
}

export interface QrInfo {
  joinUrl: string;
  qrDataUrl: string;
}

// ── Loyalty (cards, memberships, stamps) ────────────────────────────────

export interface CardBusiness {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  brandColor: string | null;
}

export interface CardCampaign {
  id: string;
  name: string;
  description: string | null;
  stampsRequired: number;
  reward: string;
  status: CampaignStatus;
}

export interface StampEntry {
  id: string;
  createdAt: string;
  delta: number;
  reason: string | null;
  completedCard: boolean;
  issuerType: StampIssuerType;
  issuerName: string;
}

/** A reward voucher: earned by completing a card, handed over at the counter. */
export interface RedemptionSummary {
  id: string;
  code: string;
  formattedCode: string;
  rewardText: string;
  earnedAt: string;
}

export interface RedemptionRow extends RedemptionSummary {
  status: RedemptionStatus;
  redeemedAt: string | null;
  redeemedBy: string | null;
  voidedAt: string | null;
  membershipId: string;
  customer: CustomerSummary;
  customerCode: string;
}

export interface Card {
  id: string;
  code: string;
  formattedCode: string;
  stampCount: number;
  completedCount: number;
  totalStamps: number;
  lastStampAt: string | null;
  joinedAt: string;
  pendingRewards: RedemptionSummary[];
  redeemedCount: number;
  business: CardBusiness;
  campaign: CardCampaign;
}

export interface CardDetail extends Card {
  recentStamps: StampEntry[];
}

export interface JoinResult {
  card: Card;
  alreadyMember: boolean;
}

export interface CustomerSummary {
  id: string;
  name: string | null;
  phone: string;
}

export interface MembershipListItem {
  id: string;
  code: string;
  formattedCode: string;
  notes: string | null;
  tags: string[];
  blockedAt: string | null;
  blockedReason: string | null;
  customer: CustomerSummary;
  stampCount: number;
  stampsRequired: number;
  completedCount: number;
  totalStamps: number;
  lastStampAt: string | null;
  joinedAt: string;
  pendingRewards: RedemptionSummary[];
}

export interface MembershipDetail extends MembershipListItem {
  campaign: CardCampaign;
}

export interface ConsentRecord {
  id: string;
  granted: boolean;
  text: string;
  textVersion: number;
  channel: string;
  createdAt: string;
}

export interface AddStampResult {
  card: MembershipListItem;
  rewardEarned: boolean;
  reward: string;
  stamp: StampEntry;
  redemption: RedemptionSummary | null;
}

export interface RedeemResult {
  redemption: RedemptionRow;
  card: MembershipListItem;
}

// ── Staff console ───────────────────────────────────────────────────────

export interface StaffContext {
  staff: { id: string; name: string; phone: string; role: StaffRole };
  business: Business;
  campaign: CardCampaign | null;
}

export interface TodaySummary {
  mine: { stamps: number; redemptions: number };
  totals: { stamps: number; newCustomers: number; rewardsRedeemed: number } | null;
  team: { id: string; name: string; stamps: number; redemptions: number }[] | null;
}

export interface EnrollResult {
  card: MembershipListItem;
  alreadyMember: boolean;
  isNewCustomer: boolean;
}

export interface UndoStampResult {
  card: MembershipListItem;
  voucherVoided: boolean;
}

export interface CardQr {
  dataUrl: string;
  code: string;
}

export interface WalletAvailability {
  apple: { available: boolean };
  google: { available: boolean };
}

// ── Dashboard ───────────────────────────────────────────────────────────

export interface DashboardStats {
  customers: number;
  stampsToday: number;
  stampsTotal: number;
  rewardsEarned: number;
  rewardsPending: number;
  rewardsRedeemed: number;
}

export interface DashboardActivityItem {
  id: string;
  type: 'STAMP' | 'REDEMPTION';
  rewardText: string | null;
  customerName: string | null;
  customerCode: string;
  membershipId: string;
  issuerName: string;
  issuerType: StampIssuerType;
  completedCard: boolean;
  createdAt: string;
}

export interface DashboardChecklist {
  hasLogo: boolean;
  hasCampaign: boolean;
  hasStaff: boolean;
  hasCustomers: boolean;
}

export interface Dashboard {
  stats: DashboardStats;
  campaign: Campaign | null;
  activity: DashboardActivityItem[];
  checklist: DashboardChecklist;
}

// ── Public ──────────────────────────────────────────────────────────────

export interface PublicCampaign {
  name: string;
  description: string | null;
  stampsRequired: number;
  reward: string;
  terms: string | null;
}

export interface PublicBusiness {
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  campaign: PublicCampaign | null;
  brandColor: string | null;
  consentText: string;
  acceptingJoins: boolean;
}

// ── Analytics, ledger, exports ──────────────────────────────────────────

export type RangeKey = '7d' | '30d' | '90d';

export interface MetricValue {
  value: number;
  change: number | null;
}

export interface AnalyticsSummary {
  range: RangeKey;
  from: string;
  stats: {
    stamps: MetricValue;
    newCustomers: MetricValue;
    rewardsRedeemed: MetricValue;
    activeCustomers: MetricValue;
  };
  totals: {
    customers: number;
    repeatCustomers: number;
    repeatRatePct: number;
    pendingRewards: number;
  };
}

export interface SeriesPoint {
  day: string;
  stamps: number;
  joins: number;
}

export interface TopCustomer {
  membershipId: string;
  name: string | null;
  phone: string;
  totalStamps: number;
  completedCount: number;
  lastStampAt: string | null;
}

export interface StaffPerformance {
  id: string;
  name: string;
  isActive: boolean;
  role: StaffRole;
  stamps: number;
}

export interface TransactionRow {
  id: string;
  createdAt: string;
  delta: number;
  reason: string | null;
  completedCard: boolean;
  issuerType: StampIssuerType;
  issuerName: string;
  membershipId: string;
  customerName: string | null;
  customerCode: string;
}

export interface TransactionTotals {
  entries: number;
  netStamps: number;
  adjustments: number;
}
