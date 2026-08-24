import { OtpService } from './otp.service';
import { RedisService } from '../redis/redis.service';
import { AppConfigService } from '../config/app-config.service';
import { SmsProvider } from '../sms/sms.types';
import { DomainException } from '../common/exceptions';

/** In-memory stand-in for the RedisService surface OtpService uses. */
class FakeRedis {
  store = new Map<string, { value: string; ttl: number }>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key)?.value ?? null;
  }
  async setWithTtl(key: string, value: string, ttl: number): Promise<void> {
    this.store.set(key, { value, ttl });
  }
  async setIfAbsent(key: string, value: string, ttl: number): Promise<boolean> {
    if (this.store.has(key)) return false;
    this.store.set(key, { value, ttl });
    return true;
  }
  async setKeepTtl(key: string, value: string): Promise<void> {
    const prev = this.store.get(key);
    this.store.set(key, { value, ttl: prev?.ttl ?? 0 });
  }
  async delete(...keys: string[]): Promise<void> {
    keys.forEach((k) => this.store.delete(k));
  }
  async ttl(key: string): Promise<number> {
    return this.store.get(key)?.ttl ?? -2;
  }
  async incrementWithWindow(key: string, ttl: number): Promise<number> {
    const next = Number(this.store.get(key)?.value ?? '0') + 1;
    this.store.set(key, { value: String(next), ttl });
    return next;
  }
}

const PHONE = '+919876500001';

describe('OtpService', () => {
  let redis: FakeRedis;
  let sms: { sendOtp: jest.Mock };
  let service: OtpService;
  let devExpose: boolean;

  beforeEach(() => {
    redis = new FakeRedis();
    sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    devExpose = true;
    const config = {
      get otpDevExpose() {
        return devExpose;
      },
      jwtRefreshSecret: 'test-pepper-secret-at-least-32-chars!!',
    } as unknown as AppConfigService;
    service = new OtpService(
      redis as unknown as RedisService,
      config,
      sms as unknown as SmsProvider,
    );
  });

  it('sends a 6-digit code and exposes it in dev mode', async () => {
    const result = await service.requestCode('MERCHANT', PHONE);
    expect(result.devCode).toMatch(/^\d{6}$/);
    expect(sms.sendOtp).toHaveBeenCalledWith(PHONE, result.devCode!, expect.stringContaining(result.devCode!));
  });

  it('hides the code when dev exposure is off', async () => {
    devExpose = false;
    const result = await service.requestCode('MERCHANT', PHONE);
    expect(result.devCode).toBeUndefined();
  });

  it('enforces the resend cooldown', async () => {
    await service.requestCode('MERCHANT', PHONE);
    await expect(service.requestCode('MERCHANT', PHONE)).rejects.toMatchObject({
      constructor: DomainException,
    });
  });

  it('verifies the correct code and consumes it', async () => {
    const { devCode } = await service.requestCode('MERCHANT', PHONE);
    await expect(service.verifyCode('MERCHANT', PHONE, devCode!)).resolves.toBeUndefined();
    // Second use must fail — the code is single-use.
    await expect(service.verifyCode('MERCHANT', PHONE, devCode!)).rejects.toThrow(
      /expired/i,
    );
  });

  it('rejects wrong codes and counts attempts', async () => {
    const { devCode } = await service.requestCode('MERCHANT', PHONE);
    const wrong = devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) {
      await expect(service.verifyCode('MERCHANT', PHONE, wrong)).rejects.toThrow(/isn't right/i);
    }
    // 5th wrong attempt exhausts the allowance…
    await expect(service.verifyCode('MERCHANT', PHONE, wrong)).rejects.toThrow();
    // …after which even the right code is rejected.
    await expect(service.verifyCode('MERCHANT', PHONE, devCode!)).rejects.toThrow();
  });

  it('scopes codes per role', async () => {
    const merchant = await service.requestCode('MERCHANT', PHONE);
    await service.requestCode('CUSTOMER', PHONE);
    // Merchant code does not validate in the customer context.
    await expect(
      service.verifyCode('CUSTOMER', PHONE, merchant.devCode!),
    ).rejects.toThrow();
  });

  it('clears the code and cooldown when the gateway fails', async () => {
    sms.sendOtp.mockRejectedValueOnce(new Error('gateway down'));
    await expect(service.requestCode('CUSTOMER', PHONE)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SMS_SEND_FAILED' }),
    });
    // Cooldown was rolled back — an immediate retry goes through.
    sms.sendOtp.mockResolvedValueOnce(undefined);
    const retry = await service.requestCode('CUSTOMER', PHONE);
    expect(retry.expiresInSec).toBeGreaterThan(0);
  });
});
