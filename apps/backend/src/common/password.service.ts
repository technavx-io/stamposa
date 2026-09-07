import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * A real argon2 hash of a random value. Verifying a submitted password
 * against this when no account exists keeps login timing constant, so a
 * missing email can't be detected by how fast the request fails.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$JDMtHZ8kM0OYAFm0hOZkMxTGVdKDXjmiCUOqfmRCPRs';

/** Argon2 password hashing shared by the merchant and staff auth flows. */
@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password);
  }

  /**
   * Timing-safe verify. Always spends the argon2 cost — even when the stored
   * hash is null (no account) — so callers get a uniform response time.
   */
  async verify(storedHash: string | null | undefined, password: string): Promise<boolean> {
    return verify(storedHash ?? DUMMY_HASH, password).catch(() => false);
  }
}
