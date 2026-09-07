import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(2_592_000),

  WEB_APP_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  UPLOAD_DIR: z.string().default('./uploads'),

  SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
  /** MSG91 credentials — all three required when SMS_PROVIDER=msg91. */
  MSG91_AUTH_KEY: z.string().optional(),
  /** DLT-approved flow/template id; the template must contain ##otp##. */
  MSG91_TEMPLATE_ID: z.string().optional(),
  /** 6-char DLT-registered sender id, e.g. STMPSA. */
  MSG91_SENDER_ID: z.string().optional(),
  OTP_DEV_EXPOSE: booleanString.default('false'),
  DEFAULT_PHONE_REGION: z.string().length(2).default('IN'),

  // ── Transactional email (merchant email verification). SMTP works with
  //    Gmail app-passwords or any mail domain; console just logs the code
  //    so the flow is testable in staging without a real mailbox. ────────
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  /** SMTP host, e.g. smtp.gmail.com — required when EMAIL_PROVIDER=smtp. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  /** true for port 465 (implicit TLS); false uses STARTTLS on 587. */
  SMTP_SECURE: booleanString.default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** From header, e.g. "Stamposa <no-reply@yourdomain.com>". */
  SMTP_FROM: z.string().optional(),

  /**
   * Whether platform admins must complete an authenticator step. Turning
   * this off makes admin sign-in password-only — convenient locally, but it
   * means one leaked password reaches every tenant's data. Keep it true in
   * production; the app refuses to start otherwise.
   */
  ADMIN_REQUIRE_2FA: booleanString.default('true'),

  // ── Wallet passes (all optional — each wallet activates when its full
  //    credential set is present; see docs/WALLET-SETUP.md) ──────────────
  /** Pass Type ID signing certificate, PEM. */
  APPLE_WALLET_CERT_PATH: z.string().optional(),
  /** Private key for the certificate, PEM. */
  APPLE_WALLET_KEY_PATH: z.string().optional(),
  APPLE_WALLET_KEY_PASSPHRASE: z.string().optional(),
  /** Apple WWDR G4 intermediate certificate, PEM. */
  APPLE_WALLET_WWDR_PATH: z.string().optional(),
  /** 10-char Apple Developer Team ID. */
  APPLE_WALLET_TEAM_ID: z.string().optional(),
  /** e.g. pass.com.stamposa.loyalty */
  APPLE_WALLET_PASS_TYPE_ID: z.string().optional(),
  /** Error monitoring (Sentry or compatible). Absent = monitoring off. */
  SENTRY_DSN: z.string().optional(),
  /** 0..1 — fraction of requests traced for performance. Default off. */
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),

  /** Numeric issuer id from the Google Pay & Wallet console. */
  GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
  /** Service-account key JSON (the account must be added to the issuer). */
  GOOGLE_WALLET_SA_KEY_PATH: z.string().optional(),

  // ── Billing: Dodo Payments (Merchant of Record) ──────────────────────
  //    Paid subscriptions activate only when DODO_API_KEY is present; until
  //    then the billing screen falls back to a "contact us" CTA. Dodo is the
  //    seller of record, so it collects and remits tax. One Dodo account
  //    belongs to the platform; merchants are its customers. Each paid tier
  //    ×interval maps to a Dodo Product id. See docs/BILLING-SETUP.md.
  /** Which Dodo environment to talk to. */
  DODO_ENVIRONMENT: z.enum(['test_mode', 'live_mode']).default('test_mode'),
  /** Secret API key (Bearer). Absent = billing off, CTA falls back to email. */
  DODO_API_KEY: z.string().optional(),
  /** Webhook signing secret (whsec_…) for verifying incoming events. */
  DODO_WEBHOOK_SECRET: z.string().optional(),
  /** Override the API base host only if Dodo changes it; otherwise derived. */
  DODO_API_BASE: z.string().url().optional(),
  /** Product ids — one per paid tier × interval (Free has no product). */
  DODO_PRODUCT_STARTER_MONTHLY: z.string().optional(),
  DODO_PRODUCT_STARTER_YEARLY: z.string().optional(),
  DODO_PRODUCT_GROWTH_MONTHLY: z.string().optional(),
  DODO_PRODUCT_GROWTH_YEARLY: z.string().optional(),
  DODO_PRODUCT_PRO_MONTHLY: z.string().optional(),
  DODO_PRODUCT_PRO_YEARLY: z.string().optional(),
}).refine((env) => env.NODE_ENV !== 'production' || env.ADMIN_REQUIRE_2FA, {
  message:
    'ADMIN_REQUIRE_2FA cannot be false in production — admin accounts reach every tenant.',
  path: ['ADMIN_REQUIRE_2FA'],
}).refine(
  (env) =>
    env.SMS_PROVIDER !== 'msg91' ||
    (!!env.MSG91_AUTH_KEY && !!env.MSG91_TEMPLATE_ID && !!env.MSG91_SENDER_ID),
  {
    message:
      'SMS_PROVIDER=msg91 needs MSG91_AUTH_KEY, MSG91_TEMPLATE_ID and MSG91_SENDER_ID.',
    path: ['SMS_PROVIDER'],
  },
).refine(
  (env) =>
    env.EMAIL_PROVIDER !== 'smtp' ||
    (!!env.SMTP_HOST && !!env.SMTP_PORT && !!env.SMTP_USER && !!env.SMTP_PASS && !!env.SMTP_FROM),
  {
    message:
      'EMAIL_PROVIDER=smtp needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.',
    path: ['EMAIL_PROVIDER'],
  },
).refine((env) => !env.DODO_API_KEY || !!env.DODO_WEBHOOK_SECRET, {
  message:
    'DODO_API_KEY is set but DODO_WEBHOOK_SECRET is missing — webhooks could not be verified, so subscriptions would never activate.',
  path: ['DODO_WEBHOOK_SECRET'],
});

export type Env = z.infer<typeof envSchema>;

/** Fails fast at boot with a readable list of every invalid variable. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
