import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

/**
 * Thin client for Dodo Payments (Merchant of Record). Intentionally
 * dependency-free — a couple of REST calls plus Standard Webhooks signature
 * verification — so the integration stays transparent and easy to audit.
 *
 * Docs: https://docs.dodopayments.com/api-reference/checkout-sessions/create
 * Webhooks follow the Standard Webhooks spec: https://www.standardwebhooks.com
 */

export interface CheckoutParams {
  productId: string;
  /** One-line customer identity Dodo shows on the receipt. */
  customer: { email: string; name: string };
  /** Where Dodo returns the buyer after a completed checkout. */
  returnUrl: string;
  /** Echoed back on every webhook — how we tie an event to a tenant. */
  metadata: Record<string, string>;
}

export interface CheckoutResult {
  sessionId: string;
  checkoutUrl: string;
}

/** Webhook headers we need for signature verification (Standard Webhooks). */
export interface WebhookHeaders {
  id: string;
  timestamp: string;
  signature: string;
}

@Injectable()
export class DodoService {
  private readonly logger = new Logger(DodoService.name);

  constructor(private readonly appConfig: AppConfigService) {}

  /** True once an API key + webhook secret are configured. */
  get enabled(): boolean {
    return this.appConfig.dodo !== null;
  }

  private cfg() {
    const cfg = this.appConfig.dodo;
    if (!cfg) {
      throw new ServiceUnavailableException(
        'Online payments are not configured yet. Please try again later.',
      );
    }
    return cfg;
  }

  /** Resolve the Dodo product id for a paid tier + interval, or throw. */
  productId(key: string): string {
    const id = this.cfg().products[key];
    if (!id) {
      throw new ServiceUnavailableException(
        `No Dodo product configured for ${key}. Set the matching DODO_PRODUCT_* env var.`,
      );
    }
    return id;
  }

  /**
   * Create a hosted checkout session for a subscription product. Currency and
   * country are left to Dodo's adaptive currency (buyer's locale); tax is
   * added and remitted by Dodo as the merchant of record.
   */
  async createSubscriptionCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const body = {
      product_cart: [{ product_id: params.productId, quantity: 1 }],
      customer: { email: params.customer.email, name: params.customer.name },
      return_url: params.returnUrl,
      metadata: params.metadata,
    };
    const res = await this.post<{ session_id: string; checkout_url: string }>('/checkouts', body);
    return { sessionId: res.session_id, checkoutUrl: res.checkout_url };
  }

  /**
   * Cancel a subscription at the end of the current period (the customer keeps
   * access until then). The row then drops to FREE on the webhook.
   *
   * NOTE: verify the exact field/endpoint against your Dodo API version — the
   * cancel semantics have varied. This uses the documented
   * `cancel_at_next_billing_date` flag on the update endpoint.
   */
  async cancelAtPeriodEnd(subscriptionId: string): Promise<void> {
    await this.patch(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      cancel_at_next_billing_date: true,
    });
  }

  // ── Webhooks ───────────────────────────────────────────────────────────

  /**
   * Verify a Standard Webhooks signature. `rawBody` MUST be the exact bytes
   * received (not a re-serialized object). Returns true only for a valid,
   * in-tolerance signature.
   */
  verifyWebhook(rawBody: string, headers: WebhookHeaders, toleranceSec = 300): boolean {
    const { webhookSecret } = this.cfg();
    if (!headers.id || !headers.timestamp || !headers.signature) return false;

    // Reject stale/future timestamps to blunt replay attacks.
    const ts = Number(headers.timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

    const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
    const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
    const expectedBuf = Buffer.from(expected);

    // The header is a space-separated list of `version,signature` pairs.
    return headers.signature.split(' ').some((part) => {
      const sig = part.includes(',') ? part.split(',')[1] : part;
      const sigBuf = Buffer.from(sig);
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    });
  }

  // ── low-level HTTP ───────────────────────────────────────────────────────

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  private async request<T>(method: string, path: string, body: unknown): Promise<T> {
    const { apiBase, apiKey } = this.cfg();
    let res: Response;
    try {
      res = await fetch(`${apiBase}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`Dodo ${method} ${path} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Payment provider is unreachable. Please try again.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Dodo ${method} ${path} → ${res.status}: ${detail}`);
      throw new ServiceUnavailableException('Payment provider returned an error. Please try again.');
    }
    return (await res.json()) as T;
  }
}
