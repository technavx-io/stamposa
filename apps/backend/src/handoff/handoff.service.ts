import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { badRequest } from '../common/exceptions';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuthActor, ActorRole } from '../auth/auth.types';
import { TokenService } from '../auth/token.service';
import { toBusinessDto } from '../businesses/dto/business.dto';
import { AuthSessionDto } from '../auth/dto/auth-response.dto';

/**
 * Cross-device merchant handoff (WhatsApp-Web / Steam-mobile pattern).
 *
 *   1. Desktop → generate(actor): mint a random 32-byte token, park it in
 *      Redis under `handoff:merchant:<token>` → { merchantId }, TTL 300s.
 *   2. Phone → consume(token): atomically GETDEL the key so it cannot be
 *      replayed, then mint a fresh merchant session for the SAME actor.
 *
 * The token holds an actor id only, so it cannot be repurposed to sign in as
 * anyone else — the fresh session comes from TokenService, not the client.
 */
const HANDOFF_TOKEN_TTL_SEC = 300; // 5 min
const HANDOFF_TOKEN_BYTES = 32;
const HANDOFF_KEY_PREFIX = 'handoff:merchant:';
const DEFAULT_GOTO = '/merchant/settings#menu-pdf';

const DARK = '#18181b';
const LIGHT = '#ffffff';

export interface HandoffGenerated {
  token: string;
  url: string;
  qrSvg: string;
  /** ISO instant the token expires. */
  expiresAt: string;
  expiresInSec: number;
}

interface StoredHandoff {
  merchantId: string;
}

/** Validate a bare in-app path — single leading slash, no protocol/host. */
export function isSafeGoto(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  if (!raw.startsWith('/')) return false;
  if (raw.startsWith('//')) return false;
  if (raw.length > 512) return false;
  // Reject control chars and whitespace that could smuggle a URL.
  return !/[\s\\]/.test(raw) && !/^\/\/+/.test(raw);
}

@Injectable()
export class HandoffService {
  constructor(
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Mint a fresh handoff token bound to this merchant actor. Callers are
   * responsible for guarding the endpoint with a merchant-auth guard AND a
   * per-actor rate limiter (see HandoffController).
   */
  async generate(actor: AuthActor, goto?: string): Promise<HandoffGenerated> {
    if (actor.role !== 'MERCHANT') {
      // Belt-and-braces: the controller's @Roles guard already refuses this.
      throw badRequest('HANDOFF_UNSUPPORTED_ROLE', 'Handoff is only available for merchants.');
    }
    const safeGoto = goto === undefined || goto === '' ? DEFAULT_GOTO : goto;
    if (!isSafeGoto(safeGoto)) {
      throw badRequest(
        'HANDOFF_INVALID_GOTO',
        'The landing path must be an in-app path starting with a single "/".',
      );
    }

    const token = randomBytes(HANDOFF_TOKEN_BYTES).toString('hex');
    const stored: StoredHandoff = { merchantId: actor.merchant.id };
    await this.redis.setWithTtl(
      this.tokenKey(token),
      JSON.stringify(stored),
      HANDOFF_TOKEN_TTL_SEC,
    );

    const url = this.buildUrl(token, safeGoto);
    const qrSvg = await QRCode.toString(url, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: DARK, light: LIGHT },
    });
    const expiresAt = new Date(Date.now() + HANDOFF_TOKEN_TTL_SEC * 1000).toISOString();

    return {
      token,
      url,
      qrSvg,
      expiresAt,
      expiresInSec: HANDOFF_TOKEN_TTL_SEC,
    };
  }

  /**
   * Consume a handoff token — atomically GET+DEL from Redis so a token can
   * never be replayed — and return a fresh merchant session envelope.
   * Errors are deliberately generic so an attacker can't tell unknown from
   * expired from already-used.
   */
  async consume(token: unknown): Promise<AuthSessionDto> {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      throw badRequest(
        'HANDOFF_INVALID',
        'This sign-in link is invalid or has expired. Generate a new one from the desktop.',
      );
    }
    const raw = await this.getDelete(this.tokenKey(token));
    if (!raw) {
      throw badRequest(
        'HANDOFF_INVALID',
        'This sign-in link is invalid or has expired. Generate a new one from the desktop.',
      );
    }
    let parsed: StoredHandoff;
    try {
      parsed = JSON.parse(raw) as StoredHandoff;
    } catch {
      throw badRequest(
        'HANDOFF_INVALID',
        'This sign-in link is invalid or has expired. Generate a new one from the desktop.',
      );
    }

    // Re-load the merchant so a since-deleted or suspended account cannot
    // consume a leftover token. Same guardrails the login path applies.
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: parsed.merchantId },
      include: { business: true },
    });
    if (!merchant || !merchant.emailVerifiedAt) {
      throw badRequest(
        'HANDOFF_INVALID',
        'This sign-in link is invalid or has expired. Generate a new one from the desktop.',
      );
    }
    if (merchant.business?.suspendedAt) {
      throw badRequest(
        'HANDOFF_INVALID',
        'This sign-in link is invalid or has expired. Generate a new one from the desktop.',
      );
    }

    const role: ActorRole = 'MERCHANT';
    const tokens = await this.tokens.issueSession(role, merchant.id);
    return {
      tokens,
      actor: {
        id: merchant.id,
        role,
        name: merchant.name ?? null,
        email: merchant.email ?? null,
        phone: merchant.phone ?? null,
      },
      business: merchant.business
        ? toBusinessDto(merchant.business, {
            apiPublicUrl: this.config.apiPublicUrl,
            webAppUrl: this.config.webAppUrl,
          })
        : null,
    };
  }

  private buildUrl(token: string, goto: string): string {
    const params = new URLSearchParams();
    params.set('token', token);
    params.set('goto', goto);
    return `${this.config.webAppUrl}/merchant/handoff?${params.toString()}`;
  }

  /**
   * Atomic GET+DEL using ioredis' native GETDEL. Guarantees a single-use
   * token: two concurrent consume() calls cannot both see a value.
   */
  private async getDelete(key: string): Promise<string | null> {
    const client = this.redis.raw;
    // ioredis exposes GETDEL as a typed method.
    return client.getdel(key);
  }

  private tokenKey(token: string): string {
    return `${HANDOFF_KEY_PREFIX}${token}`;
  }
}
