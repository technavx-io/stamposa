import { Injectable } from '@nestjs/common';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppConfigService } from '../config/app-config.service';
import { badRequest } from './exceptions';

/**
 * All phone numbers are stored in E.164 (+919876543210). Numbers typed
 * without a country code are interpreted in DEFAULT_PHONE_REGION.
 */
@Injectable()
export class PhoneService {
  constructor(private readonly config: AppConfigService) {}

  normalize(input: string): string {
    const parsed = parsePhoneNumberFromString(
      input.trim(),
      this.config.defaultPhoneRegion as CountryCode,
    );
    if (!parsed || !parsed.isValid()) {
      throw badRequest(
        'INVALID_PHONE',
        'Enter a valid phone number, including the country code if outside your region.',
      );
    }
    return parsed.number;
  }

  /** "+91 98765 43210" for display; falls back to the raw value. */
  pretty(e164: string): string {
    const parsed = parsePhoneNumberFromString(e164);
    return parsed ? parsed.formatInternational() : e164;
  }

  /** "+91•••••3210" — safe for logs. */
  mask(e164: string): string {
    if (e164.length < 7) return '•••';
    return `${e164.slice(0, 3)}•••••${e164.slice(-4)}`;
  }
}
