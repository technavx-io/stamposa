import { ApiClient, customerClient, merchantClient, staffClient } from './client';
import type {
  ActorRole,
  AddStampResult,
  AuthResult,
  AuthSession,
  Business,
  Campaign,
  Card,
  CardDetail,
  Dashboard,
  EmailVerificationRequested,
  JoinResult,
  Me,
  MembershipDetail,
  MembershipListItem,
  OtpRequested,
  AnalyticsSummary,
  ConsentRecord,
  Paginated,
  PublicBusiness,
  RangeKey,
  SeriesPoint,
  StaffPerformance,
  TopCustomer,
  TransactionRow,
  TransactionTotals,
  QrInfo,
  RedeemResult,
  RedemptionRow,
  RedemptionStatus,
  StaffContext,
  StaffMember,
  StaffRole,
  StampEntry,
  CardQr,
  WalletAvailability,
  EnrollResult,
  TodaySummary,
  UndoStampResult,
} from './types';

// ── Auth (role-parameterised) ───────────────────────────────────────────

const rolePath: Record<ActorRole, string> = {
  MERCHANT: 'merchant',
  STAFF: 'staff',
  CUSTOMER: 'customer',
};

/** me() + logout(), shared by every role regardless of how they sign in. */
function sessionApi(client: ApiClient) {
  return {
    me: () => client.get<Me>('/auth/me'),
    logout: (refreshToken: string) =>
      client.post<{ success: boolean }>('/auth/logout', { refreshToken }, { anonymous: true }),
  };
}

export function authApi(role: ActorRole, client: ApiClient) {
  return {
    requestOtp: (phone: string) =>
      client.post<OtpRequested>(`/auth/${rolePath[role]}/otp/request`, { phone }, { anonymous: true }),
    verifyOtp: (phone: string, code: string) =>
      client.post<AuthResult>(`/auth/${rolePath[role]}/otp/verify`, { phone, code }, { anonymous: true }),
    register: (registrationToken: string, name: string) =>
      client.post<AuthSession>(`/auth/${rolePath[role]}/register`, { registrationToken, name }, { anonymous: true }),
    me: () => client.get<Me>('/auth/me'),
    logout: (refreshToken: string) =>
      client.post<{ success: boolean }>('/auth/logout', { refreshToken }, { anonymous: true }),
  };
}

// ── Merchant portal ─────────────────────────────────────────────────────

export const merchantApi = {
  auth: {
    ...sessionApi(merchantClient),
    signup: (email: string, password: string, name: string) =>
      merchantClient.post<EmailVerificationRequested>(
        '/auth/merchant/signup',
        { email, password, name },
        { anonymous: true },
      ),
    verifyEmail: (email: string, code: string) =>
      merchantClient.post<AuthSession>(
        '/auth/merchant/verify-email',
        { email, code },
        { anonymous: true },
      ),
    resendEmailVerification: (email: string) =>
      merchantClient.post<OtpRequested>(
        '/auth/merchant/verify-email/resend',
        { email },
        { anonymous: true },
      ),
    login: (email: string, password: string) =>
      merchantClient.post<AuthSession>(
        '/auth/merchant/login',
        { email, password },
        { anonymous: true },
      ),
  },

  createBusiness: (data: { name: string; address?: string; phone?: string }) =>
    merchantClient.post<Business>('/merchant/business', data),
  getBusiness: () => merchantClient.get<Business>('/merchant/business'),
  updateBusiness: (data: {
    name?: string;
    address?: string;
    phone?: string;
    brandColor?: string;
    stampIcon?: string | null;
    rewardIcon?: string | null;
    category?: string;
    timezone?: string;
    consentText?: string;
    notifyDailySummary?: boolean;
    notifyWeeklyDigest?: boolean;
    notifyStaffInactive?: boolean;
  }) => merchantClient.patch<Business>('/merchant/business', data),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return merchantClient.request<Business>('/merchant/business/logo', {
      method: 'POST',
      formData,
    });
  },
  removeLogo: () => merchantClient.delete<Business>('/merchant/business/logo'),
  uploadCardImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return merchantClient.request<Business>('/merchant/business/card-image', {
      method: 'POST',
      formData,
    });
  },
  removeCardImage: () => merchantClient.delete<Business>('/merchant/business/card-image'),
  getQr: (size = 512) => merchantClient.get<QrInfo>(`/merchant/business/qr?size=${size}`),
  qrPngUrl: () => `/merchant/business/qr.png`,

  dashboard: () => merchantClient.get<Dashboard>('/merchant/dashboard'),

  createCampaign: (data: {
    name: string;
    description?: string;
    stampsRequired: number;
    reward: string;
    dailyStampCap?: number;
    terms?: string;
    cardColor?: string | null;
    stampIcon?: string | null;
    rewardIcon?: string | null;
  }) => merchantClient.post<Campaign>('/merchant/campaigns', data),
  listCampaigns: () => merchantClient.get<Campaign[]>('/merchant/campaigns'),
  updateCampaign: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      stampsRequired: number;
      reward: string;
      dailyStampCap: number | null;
      terms: string;
      status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
      cardColor: string | null;
      stampIcon: string | null;
      rewardIcon: string | null;
    }>,
  ) => merchantClient.patch<Campaign>(`/merchant/campaigns/${id}`, data),
  uploadCampaignCardImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return merchantClient.request<Campaign>(`/merchant/campaigns/${id}/card-image`, {
      method: 'POST',
      formData,
    });
  },
  removeCampaignCardImage: (id: string) =>
    merchantClient.delete<Campaign>(`/merchant/campaigns/${id}/card-image`),

  listStaff: () => merchantClient.get<StaffMember[]>('/merchant/staff'),
  createStaff: (data: { name: string; email: string; password: string; role?: StaffRole }) =>
    merchantClient.post<StaffMember>('/merchant/staff', data),
  updateStaff: (id: string, data: { name?: string; password?: string; isActive?: boolean; role?: StaffRole }) =>
    merchantClient.patch<StaffMember>(`/merchant/staff/${id}`, data),

  listCustomers: (params: { search?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 20));
    return merchantClient.get<Paginated<MembershipListItem>>(`/merchant/customers?${q}`);
  },
  customerDetail: (membershipId: string) =>
    merchantClient.get<MembershipDetail>(`/merchant/customers/${membershipId}`),
  customerStamps: (membershipId: string, page = 1, limit = 20) =>
    merchantClient.get<Paginated<StampEntry>>(
      `/merchant/customers/${membershipId}/stamps?page=${page}&limit=${limit}`,
    ),
  addStampAsOwner: (membershipId: string) =>
    merchantClient.post<AddStampResult>(`/merchant/customers/${membershipId}/stamps`),

  listRedemptions: (params: {
    status?: RedemptionStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 20));
    return merchantClient.get<Paginated<RedemptionRow>>(`/merchant/redemptions?${q}`);
  },
  redeemAsOwner: (input: { redemptionId?: string; code?: string }) =>
    merchantClient.post<RedeemResult>('/merchant/redemptions/redeem', input),

  // ── CRM ───────────────────────────────────────────────────────────────
  updateCustomer: (membershipId: string, data: { notes?: string; tags?: string[] }) =>
    merchantClient.patch<MembershipDetail>(`/merchant/customers/${membershipId}`, data),
  adjustBalance: (membershipId: string, delta: number, reason: string) =>
    merchantClient.post<{ card: MembershipDetail; rewardEarned: boolean }>(
      `/merchant/customers/${membershipId}/adjust`,
      { delta, reason },
    ),
  setBlocked: (membershipId: string, blocked: boolean, reason?: string) =>
    merchantClient.post<MembershipDetail>(`/merchant/customers/${membershipId}/block`, {
      blocked,
      reason,
    }),
  customerConsents: (membershipId: string) =>
    merchantClient.get<ConsentRecord[]>(`/merchant/customers/${membershipId}/consents`),

  // ── Analytics ─────────────────────────────────────────────────────────
  analyticsSummary: (range: RangeKey) =>
    merchantClient.get<AnalyticsSummary>(`/merchant/analytics/summary?range=${range}`),
  analyticsSeries: (range: RangeKey) =>
    merchantClient.get<SeriesPoint[]>(`/merchant/analytics/series?range=${range}`),
  topCustomers: () => merchantClient.get<TopCustomer[]>('/merchant/analytics/top-customers'),
  staffPerformance: (range: RangeKey) =>
    merchantClient.get<StaffPerformance[]>(`/merchant/analytics/staff?range=${range}`),

  // ── Ledger ────────────────────────────────────────────────────────────
  transactions: (params: {
    search?: string;
    issuerType?: string;
    staffId?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.issuerType) q.set('issuerType', params.issuerType);
    if (params.staffId) q.set('staffId', params.staffId);
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 25));
    return merchantClient.get<Paginated<TransactionRow>>(`/merchant/transactions?${q}`);
  },
  transactionTotals: () => merchantClient.get<TransactionTotals>('/merchant/transactions/totals'),

  /** Export paths — fetched with the auth header, then saved as a file. */
  exportPaths: {
    customers: '/merchant/export/customers.csv',
    transactions: '/merchant/export/transactions.csv',
    rewards: '/merchant/export/rewards.csv',
  },
};

// ── Staff console ───────────────────────────────────────────────────────

export const staffApi = {
  auth: {
    ...sessionApi(staffClient),
    login: (email: string, password: string) =>
      staffClient.post<AuthSession>(
        '/auth/staff/login',
        { email, password },
        { anonymous: true },
      ),
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    staffClient.post<{ success: boolean }>('/staff/password', { currentPassword, newPassword }),
  context: () => staffClient.get<StaffContext>('/staff/context'),
  search: (q: string) =>
    staffClient.get<MembershipListItem[]>(`/staff/customers/search?q=${encodeURIComponent(q)}`),
  addStamp: (membershipId: string) =>
    staffClient.post<AddStampResult>('/staff/stamps', { membershipId }),
  undoStamp: (membershipId: string) =>
    staffClient.post<UndoStampResult>('/staff/stamps/undo', { membershipId }),
  enroll: (data: { phone: string; name?: string; marketingConsent?: boolean }) =>
    staffClient.post<EnrollResult>('/staff/enroll', data),
  today: () => staffClient.get<TodaySummary>('/staff/today'),
  redeem: (input: { redemptionId?: string; code?: string }) =>
    staffClient.post<RedeemResult>('/staff/redemptions/redeem', input),
};

// ── Customer portal ─────────────────────────────────────────────────────

export const customerApi = {
  auth: authApi('CUSTOMER', customerClient),
  join: (businessSlug: string, marketingConsent = false) =>
    customerClient.post<JoinResult>('/customer/memberships', {
      businessSlug,
      marketingConsent,
    }),
  cards: () => customerClient.get<Card[]>('/customer/cards'),
  card: (membershipId: string) =>
    customerClient.get<CardDetail>(`/customer/cards/${membershipId}`),
  cardQr: (membershipId: string) =>
    customerClient.get<CardQr>(`/customer/cards/${membershipId}/qr`),
  walletAvailability: (membershipId: string) =>
    customerClient.get<WalletAvailability>(`/customer/cards/${membershipId}/wallet`),
  googleWalletLink: (membershipId: string) =>
    customerClient.post<{ saveUrl: string }>(`/customer/cards/${membershipId}/wallet/google`),
  appleWalletPath: (membershipId: string) =>
    `/customer/cards/${membershipId}/wallet/apple.pkpass`,
};

// ── Public ──────────────────────────────────────────────────────────────

export const publicApi = {
  business: (slug: string) =>
    customerClient.get<PublicBusiness>(`/public/businesses/${slug}`, { anonymous: true }),
};
