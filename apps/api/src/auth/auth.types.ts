import { Business, Customer, Merchant, Staff } from '@prisma/client';

export const ActorRoles = {
  MERCHANT: 'MERCHANT',
  STAFF: 'STAFF',
  CUSTOMER: 'CUSTOMER',
} as const;

export type ActorRole = (typeof ActorRoles)[keyof typeof ActorRoles];

/** Resolved, DB-fresh identity attached to every authenticated request. */
/** Rides inside impersonated merchant tokens so every layer knows. */
export interface ImpersonationClaim {
  sessionId: string;
  adminLabel: string;
  /** ISO instant the support session ends; token TTLs are clamped to it. */
  expiresAt: string;
}

export type AuthActor =
  | {
      role: 'MERCHANT';
      merchant: Merchant & { business: Business | null };
      impersonation?: ImpersonationClaim;
    }
  | { role: 'STAFF'; staff: Staff & { business: Business } }
  | { role: 'CUSTOMER'; customer: Customer };

export type TokenType = 'access' | 'refresh' | 'registration';

export interface JwtPayload {
  /** Actor id for access/refresh tokens; E.164 phone for registration tokens. */
  sub: string;
  role: ActorRole;
  type: TokenType;
  /** Session id — refresh tokens only; keyed in Redis for revocation. */
  jti?: string;
  /** Present only on impersonated merchant sessions (admin support). */
  imp?: ImpersonationClaim;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSec: number;
}
