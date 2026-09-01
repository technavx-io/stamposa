import { Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';

import { badRequest } from './exceptions';
import { PhoneService } from './phone.service';

export type IdentifierKind = 'PHONE' | 'EMAIL';

export interface Identifier {
  kind: IdentifierKind;
  /** E.164 for phones, lowercased+trimmed for email. Safe to store and to key on. */
  value: string;
}

/**
 * A customer is identified by a phone number OR an email address — whichever
 * they gave us. This is the single place that decides which one an input is
 * and normalises it, so every caller keys on the same canonical string.
 *
 * Normalisation is not cosmetic: it is what makes the uniqueness guarantee
 * real. "+91 98765 43210" and "+919876543210" must collide, and so must
 * "Ami@Example.com" and "ami@example.com" — otherwise one person quietly ends
 * up with two loyalty cards and a split stamp history.
 */
@Injectable()
export class IdentifierService {
  constructor(private readonly phones: PhoneService) {}

  /**
   * Classify then normalise. Anything containing "@" is treated as an email
   * attempt, so a mistyped address reports an email error rather than a
   * confusing "invalid phone number".
   */
  normalize(input: string): Identifier {
    const trimmed = input.trim();
    if (!trimmed) {
      throw badRequest('IDENTIFIER_REQUIRED', 'Enter a phone number or an email address.');
    }

    if (trimmed.includes('@')) {
      const email = trimmed.toLowerCase();
      if (!isEmail(email)) {
        throw badRequest('INVALID_EMAIL', 'Enter a valid email address.');
      }
      return { kind: 'EMAIL', value: email };
    }

    return { kind: 'PHONE', value: this.phones.normalize(trimmed) };
  }

  /** The Prisma `where` clause for looking a person up by this identifier. */
  whereClause(id: Identifier): { phone: string } | { email: string } {
    return id.kind === 'PHONE' ? { phone: id.value } : { email: id.value };
  }

  /** Safe for logs: never emits a full phone number or address. */
  mask(id: Identifier): string {
    if (id.kind === 'PHONE') return this.phones.mask(id.value);
    const [local, domain] = id.value.split('@');
    const head = local.slice(0, 2);
    return `${head}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }

  /** Human-readable, for message copy ("we sent a code to …"). */
  pretty(id: Identifier): string {
    return id.kind === 'PHONE' ? this.phones.pretty(id.value) : id.value;
  }
}
