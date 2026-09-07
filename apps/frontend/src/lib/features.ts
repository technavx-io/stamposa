/**
 * Build-time feature flags.
 *
 * PHONE_AUTH_ENABLED gates customer sign-in by phone (SMS OTP). It is OFF until
 * MSG91 + Indian DLT registration are in place — without them SMS cannot be
 * delivered, so offering phone sign-in would be a dead end. While it is off,
 * customers sign in with email only. Flip NEXT_PUBLIC_PHONE_AUTH_ENABLED to
 * "true" and rebuild once SMS works; nothing else needs to change.
 */
export const PHONE_AUTH_ENABLED = process.env.NEXT_PUBLIC_PHONE_AUTH_ENABLED === 'true';
