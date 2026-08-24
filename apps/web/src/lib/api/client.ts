import type { ActorRole, ApiErrorBody, Tokens } from './types';
import { SessionStore, sessionFor } from '../auth/session';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSec?: number;
  readonly details?: unknown;
  /** Server-issued correlation id — shown in error UIs for support. */
  readonly requestId?: string;

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.message ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'ERROR';
    this.retryAfterSec = body?.retryAfterSec;
    this.details = body?.details;
    this.requestId = body?.requestId;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (public endpoints). */
  anonymous?: boolean;
  /** Multipart body — caller passes FormData in `body`. */
  formData?: FormData;
  signal?: AbortSignal;
}

/**
 * Fetch wrapper bound to one portal's session. On 401 it refreshes the token
 * once (single-flight) and retries; if the refresh fails the session is
 * cleared and the portal guard redirects to login.
 */
export class ApiClient {
  private readonly store: SessionStore;
  private refreshing: Promise<boolean> | null = null;

  constructor(role: ActorRole) {
    this.store = sessionFor(role);
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const first = await this.rawRequest(path, options);
    if (first.status !== 401 || options.anonymous) {
      return this.parse<T>(first);
    }

    const refreshed = await this.refreshOnce();
    if (!refreshed) {
      this.store.clear();
      return this.parse<T>(first);
    }
    const retried = await this.rawRequest(path, options);
    if (retried.status === 401) this.store.clear();
    return this.parse<T>(retried);
  }

  get<T>(path: string, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private async rawRequest(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {};
    if (!options.anonymous) {
      const token = this.store.get()?.tokens.accessToken;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    let body: BodyInit | undefined;
    if (options.formData) {
      body = options.formData;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    return fetch(`${API_URL}/v1${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: options.signal,
    });
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      throw new ApiError(res.status, json as Partial<ApiErrorBody> | null);
    }
    return json as T;
  }

  /** Single-flight refresh shared by concurrent 401s. */
  private refreshOnce(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const session = this.store.get();
    if (!session) return false;
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.tokens.refreshToken }),
      });
      if (!res.ok) return false;
      const tokens = (await res.json()) as Tokens;
      this.store.updateTokens(tokens);
      return true;
    } catch {
      return false;
    }
  }
}

export const merchantClient = new ApiClient('MERCHANT');
export const staffClient = new ApiClient('STAFF');
export const customerClient = new ApiClient('CUSTOMER');
