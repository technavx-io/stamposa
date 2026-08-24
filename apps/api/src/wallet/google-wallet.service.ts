import { readFileSync } from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AppConfigService } from '../config/app-config.service';
import { formatCode } from '../common/utils/codes.util';
import { PassMembership } from './apple-pass.service';

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/**
 * Google Wallet loyalty cards. One LoyaltyClass per business, one
 * LoyaltyObject per card. The "save" link is a signed JWT that embeds the
 * object, so it works even before the REST insert; updates go through the
 * REST API and Google pushes them to phones itself.
 */
@Injectable()
export class GoogleWalletService {
  private readonly logger = new Logger(GoogleWalletService.name);
  private key: ServiceAccountKey | null = null;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: AppConfigService) {}

  get enabled(): boolean {
    return this.config.googleWallet !== null;
  }

  private get issuerId(): string {
    const cfg = this.config.googleWallet;
    if (!cfg) throw new Error('Google Wallet is not configured');
    return cfg.issuerId;
  }

  private serviceAccount(): ServiceAccountKey {
    if (!this.key) {
      const cfg = this.config.googleWallet;
      if (!cfg) throw new Error('Google Wallet is not configured');
      this.key = JSON.parse(readFileSync(cfg.saKeyPath, 'utf8')) as ServiceAccountKey;
    }
    return this.key;
  }

  classId(businessId: string): string {
    return `${this.issuerId}.biz_${businessId}`;
  }

  objectId(membershipId: string): string {
    return `${this.issuerId}.card_${membershipId}`;
  }

  /** LoyaltyClass payload for a business — pure, unit-testable. */
  buildClass(business: PassMembership['business'], campaign: PassMembership['campaign']) {
    return {
      id: this.classId(business.id),
      issuerName: business.name,
      programName: campaign.name,
      reviewStatus: 'UNDER_REVIEW',
      hexBackgroundColor: business.brandColor ?? '#4F46E5',
      countryCode: 'IN',
      ...(business.logoPath
        ? {
            programLogo: {
              sourceUri: { uri: `${this.config.apiPublicUrl}${business.logoPath}` },
              contentDescription: {
                defaultValue: { language: 'en', value: `${business.name} logo` },
              },
            },
          }
        : {}),
    };
  }

  /** LoyaltyObject payload for a card — pure, unit-testable. */
  buildObject(m: PassMembership) {
    const pending = m.redemptions.length;
    return {
      id: this.objectId(m.id),
      classId: this.classId(m.businessId),
      state: 'ACTIVE',
      accountId: formatCode(m.code),
      accountName: m.customer.name ?? formatCode(m.code),
      loyaltyPoints: {
        label: 'Stamps',
        balance: { string: `${m.stampCount} / ${m.campaign.stampsRequired}` },
      },
      secondaryLoyaltyPoints: {
        label: 'Rewards ready',
        balance: { string: `${pending}` },
      },
      barcode: {
        type: 'QR_CODE',
        value: formatCode(m.code),
        alternateText: formatCode(m.code),
      },
      textModulesData: [
        {
          id: 'reward',
          header: 'Reward',
          body: `Collect ${m.campaign.stampsRequired} stamps to earn: ${m.campaign.reward}`,
        },
        ...(m.campaign.terms ? [{ id: 'terms', header: 'Terms', body: m.campaign.terms }] : []),
      ],
    };
  }

  /**
   * The "Save to Google Wallet" link. Ensures the class exists (and the
   * object is current) via REST when reachable; the JWT embeds the object
   * either way, so the link still works offline from the API's view.
   */
  async saveLink(m: PassMembership): Promise<{ saveUrl: string; objectId: string }> {
    const sa = this.serviceAccount();
    const cls = this.buildClass(m.business, m.campaign);
    const obj = this.buildObject(m);

    await this.upsert('loyaltyClass', cls.id, cls);
    await this.upsert('loyaltyObject', obj.id, obj);

    const token = jwt.sign(
      {
        iss: sa.client_email,
        aud: 'google',
        typ: 'savetowallet',
        origins: [this.config.webAppUrl],
        payload: { loyaltyObjects: [obj] },
      },
      sa.private_key,
      { algorithm: 'RS256' },
    );
    return { saveUrl: `https://pay.google.com/gp/v/save/${token}`, objectId: obj.id };
  }

  /** Push the current card state to Google (they fan out to devices). */
  async syncObject(m: PassMembership): Promise<void> {
    const obj = this.buildObject(m);
    await this.upsert('loyaltyObject', obj.id, obj);
  }

  /** Insert-or-patch against the Wallet API; failures log and never throw. */
  private async upsert(kind: 'loyaltyClass' | 'loyaltyObject', id: string, body: unknown) {
    try {
      const auth = { Authorization: `Bearer ${await this.accessToken()}` };
      const url = `${WALLET_API}/${kind}/${encodeURIComponent(id)}`;
      const existing = await fetch(url, { headers: auth });
      if (existing.status === 404) {
        const res = await fetch(`${WALLET_API}/${kind}`, {
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${kind} insert ${res.status}: ${await res.text()}`);
      } else if (existing.ok) {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${kind} patch ${res.status}: ${await res.text()}`);
      } else {
        throw new Error(`${kind} get ${existing.status}`);
      }
    } catch (e) {
      // The save-link JWT carries the object, so a REST hiccup only delays
      // updates — it must never break the user-facing flow.
      this.logger.warn(`Google Wallet ${kind} upsert failed: ${(e as Error).message}`);
    }
  }

  /** OAuth2 service-account flow, cached until shortly before expiry. */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const sa = this.serviceAccount();
    const assertion = jwt.sign(
      { iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL },
      sa.private_key,
      { algorithm: 'RS256', expiresIn: 3600 },
    );
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) throw new Error(`token endpoint ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 120) * 1000,
    };
    return this.token.value;
  }
}
