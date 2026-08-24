import { randomInt } from 'crypto';

/** Unambiguous alphabet — no 0/O, 1/I/L — for codes read out at a counter. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

/**
 * Shared 8-char code generator (customer codes, redemption vouchers).
 * ~6.5e11 combinations; collisions are handled by a unique index + retry.
 */
export function generateCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

/** Display form: ABCD-EFGH. */
export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Normalises user input ("abcd-efgh ") back to the stored form. */
export function normalizeCodeInput(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/** URL-safe slug from a business name; uniqueness handled by the caller. */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || 'business';
}

/** Short random suffix for de-duplicating slugs. */
export function slugSuffix(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)].toLowerCase();
  }
  return out;
}
