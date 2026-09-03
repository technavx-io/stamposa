import { API_URL, ApiError } from './client';
import { adminSession } from '../admin/admin-session';
import type {
  AdminDashboard,
  AdminHealth,
  AdminLoginResult,
  AdminMerchantDetail,
  AdminMerchantRow,
  AdminProfile,
  AdminRole,
  AdminSession,
  AdminTeamMember,
  AdminTokens,
  AuditEntry,
  CreateAdminResult,
  CustomerLookupResult,
  FeedbackAuthorType,
  FeedbackCounts,
  FeedbackEntry,
  FeedbackStatus,
  ImpersonationResult,
  MerchantFilter,
} from './admin-types';
import type { Paginated } from './types';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  anonymous?: boolean;
}

/**
 * Admin fetch wrapper. Mirrors the tenant client's single-flight refresh,
 * but bound to the admin session store and admin refresh endpoint.
 */
class AdminApiClient {
  private refreshing: Promise<boolean> | null = null;

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const first = await this.raw(path, options);
    if (first.status !== 401 || options.anonymous) return this.parse<T>(first);

    const refreshed = await this.refreshOnce();
    if (!refreshed) {
      adminSession.clear();
      return this.parse<T>(first);
    }
    const retried = await this.raw(path, options);
    if (retried.status === 401) adminSession.clear();
    return this.parse<T>(retried);
  }

  private async raw(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {};
    if (!options.anonymous) {
      const token = adminSession.get()?.tokens.accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    return fetch(`${API_URL}/v1${path}`, { method: options.method ?? 'GET', headers, body });
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ApiError(res.status, json);
    return json as T;
  }

  private refreshOnce(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const session = adminSession.get();
    if (!session) return false;
    try {
      const res = await fetch(`${API_URL}/v1/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { tokens: AdminTokens; admin: AdminProfile };
      adminSession.set({ tokens: data.tokens, admin: data.admin });
      return true;
    } catch {
      return false;
    }
  }
}

const client = new AdminApiClient();

const qs = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  return q.toString();
};

export const adminApi = {
  // Auth
  /**
   * Returns a full session directly when two-factor is disabled by config,
   * otherwise the interim two-factor challenge.
   */
  login: (email: string, password: string) =>
    client.request<AdminLoginResult | AdminSession>('/admin/auth/login', {
      method: 'POST',
      body: { email, password },
      anonymous: true,
    }),
  enrollTwoFactor: (twoFactorToken: string, code: string) =>
    client.request<AdminSession>('/admin/auth/2fa/enroll', {
      method: 'POST',
      body: { twoFactorToken, code },
      anonymous: true,
    }),
  verifyTwoFactor: (twoFactorToken: string, code: string) =>
    client.request<AdminSession>('/admin/auth/2fa/verify', {
      method: 'POST',
      body: { twoFactorToken, code },
      anonymous: true,
    }),
  logout: (refreshToken: string) =>
    client.request<{ success: boolean }>('/admin/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      anonymous: true,
    }),
  me: () => client.request<AdminProfile>('/admin/auth/me'),

  // Dashboard
  dashboard: () => client.request<AdminDashboard>('/admin/dashboard'),

  // Merchants
  merchants: (params: { filter?: MerchantFilter; search?: string; page?: number; limit?: number }) =>
    client.request<Paginated<AdminMerchantRow>>(
      `/admin/merchants?${qs({
        filter: params.filter,
        search: params.search,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      })}`,
    ),
  merchant: (id: string) => client.request<AdminMerchantDetail>(`/admin/merchants/${id}`),
  merchantCustomers: (id: string, page = 1, limit = 10) =>
    client.request<Paginated<import('./admin-types').AdminTenantCustomer>>(
      `/admin/merchants/${id}/customers?${qs({ page, limit })}`,
    ),
  merchantAudit: (id: string, page = 1, limit = 20) =>
    client.request<Paginated<AuditEntry>>(`/admin/merchants/${id}/audit?${qs({ page, limit })}`),
  suspend: (id: string, reason: string, confirmName: string) =>
    client.request<{ suspended: boolean }>(`/admin/merchants/${id}/suspend`, {
      method: 'POST',
      body: { reason, confirmName },
    }),
  reactivate: (id: string) =>
    client.request<{ suspended: boolean }>(`/admin/merchants/${id}/reactivate`, { method: 'POST' }),
  saveNotes: (id: string, notes: string) =>
    client.request<{ adminNotes: string | null }>(`/admin/merchants/${id}/notes`, {
      method: 'PATCH',
      body: { notes },
    }),
  impersonate: (id: string, reason: string) =>
    client.request<ImpersonationResult>(`/admin/merchants/${id}/impersonate`, {
      method: 'POST',
      body: { reason },
    }),

  // Customer lookup
  lookupCustomer: (phone: string, reason: string) =>
    client.request<CustomerLookupResult>('/admin/customers/lookup', {
      method: 'POST',
      body: { phone, reason },
    }),
  eraseCustomer: (customerId: string, reason: string, confirm: string) =>
    client.request<{ erased: boolean; memberships: number }>(
      `/admin/customers/${customerId}/erase`,
      { method: 'POST', body: { reason, confirm } },
    ),

  // Audit
  audit: (params: { action?: string; search?: string; page?: number; limit?: number }) =>
    client.request<Paginated<AuditEntry>>(
      `/admin/audit?${qs({
        action: params.action,
        search: params.search,
        page: params.page ?? 1,
        limit: params.limit ?? 25,
      })}`,
    ),
  auditActions: () => client.request<string[]>('/admin/audit/actions'),

  // Feedback
  feedback: (params: {
    status?: FeedbackStatus;
    authorType?: FeedbackAuthorType;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    client.request<Paginated<FeedbackEntry>>(
      `/admin/feedback?${qs({
        status: params.status,
        authorType: params.authorType,
        search: params.search,
        page: params.page ?? 1,
        limit: params.limit ?? 25,
      })}`,
    ),
  feedbackCounts: () => client.request<FeedbackCounts>('/admin/feedback/counts'),
  setFeedbackStatus: (id: string, status: FeedbackStatus) =>
    client.request<FeedbackEntry>(`/admin/feedback/${id}`, { method: 'PATCH', body: { status } }),

  // Team
  team: () => client.request<AdminTeamMember[]>('/admin/team'),
  createAdmin: (input: { email: string; name: string; role: AdminRole }) =>
    client.request<CreateAdminResult>('/admin/team', { method: 'POST', body: input }),
  updateAdmin: (id: string, input: { name?: string; role?: AdminRole; isActive?: boolean }) =>
    client.request<AdminTeamMember>(`/admin/team/${id}`, { method: 'PATCH', body: input }),
  revokeSessions: (id: string) =>
    client.request<{ revoked: boolean }>(`/admin/team/${id}/revoke-sessions`, { method: 'POST' }),

  // Health
  health: () => client.request<AdminHealth>('/admin/health'),
};
