import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import type { ApiErrorBody } from './types';

describe('ApiError', () => {
  it('parses the legacy Stamposa envelope', () => {
    const body: ApiErrorBody = {
      statusCode: 409,
      code: 'ALREADY_REDEEMED',
      message: 'This voucher was already redeemed.',
      requestId: 'req-42',
      path: '/v1/staff/redemptions/redeem',
      timestamp: '2026-09-08T09:00:00.000Z',
    };
    const err = new ApiError(409, body);

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(409);
    expect(err.code).toBe('ALREADY_REDEEMED');
    expect(err.message).toBe('This voucher was already redeemed.');
    expect(err.requestId).toBe('req-42');
  });

  it('falls back to RFC 7807 fields when legacy fields are absent', () => {
    // Simulates the post-migration shape after legacy fields are dropped.
    const body: Partial<ApiErrorBody> = {
      type: 'about:blank',
      title: 'CONFLICT',
      status: 409,
      detail: 'Duplicate stamp.',
      instance: '/v1/staff/stamps',
    };
    const err = new ApiError(409, body);

    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Duplicate stamp.');
    expect(err.status).toBe(409);
  });

  it('prefers legacy fields over RFC when both are present (transition period)', () => {
    // The backend currently emits both blocks; legacy wins so behavior is
    // unchanged for existing consumers.
    const body: Partial<ApiErrorBody> = {
      code: 'LEGACY_CODE',
      message: 'legacy message',
      title: 'RFC_TITLE',
      detail: 'rfc detail',
    };
    const err = new ApiError(400, body);

    expect(err.code).toBe('LEGACY_CODE');
    expect(err.message).toBe('legacy message');
  });

  it('handles a null body without crashing', () => {
    const err = new ApiError(500, null);
    expect(err.status).toBe(500);
    expect(err.code).toBe('ERROR');
    expect(err.message).toBe('Request failed (500)');
  });

  it('exposes retryAfterSec and details when present', () => {
    const body: ApiErrorBody = {
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests.',
      retryAfterSec: 30,
      details: { limit: 100 },
      path: '/v1/health',
      timestamp: '2026-09-08T09:00:00.000Z',
    };
    const err = new ApiError(429, body);

    expect(err.retryAfterSec).toBe(30);
    expect(err.details).toEqual({ limit: 100 });
  });
});
