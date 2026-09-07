import { AppConfigService } from '../config/app-config.service';
import { Msg91SmsProvider } from './msg91-sms.provider';

const config = {
  msg91: { authKey: 'AK123', templateId: 'TPL456', senderId: 'STMPSA' },
} as unknown as AppConfigService;

function mockFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('Msg91SmsProvider', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('posts the code as the ##otp## template variable', async () => {
    const fetchMock = mockFetch(200, { type: 'success', message: 'req-1' });
    global.fetch = fetchMock as unknown as typeof fetch;

    await new Msg91SmsProvider(config).sendOtp('+919876543210', '123456', 'unused text');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://control.msg91.com/api/v5/flow');
    expect(init.headers.authkey).toBe('AK123');
    const body = JSON.parse(init.body);
    expect(body.template_id).toBe('TPL456');
    expect(body.sender).toBe('STMPSA');
    // '+' stripped — MSG91 wants bare digits with country code.
    expect(body.recipients).toEqual([{ mobiles: '919876543210', otp: '123456' }]);
  });

  it('throws when the gateway reports an error', async () => {
    global.fetch = mockFetch(200, {
      type: 'error',
      message: 'Invalid template',
    }) as unknown as typeof fetch;

    await expect(
      new Msg91SmsProvider(config).sendOtp('+919876543210', '123456', ''),
    ).rejects.toThrow(/Invalid template/);
  });

  it('throws on a non-2xx response', async () => {
    global.fetch = mockFetch(401, { message: 'unauthorised' }) as unknown as typeof fetch;

    await expect(
      new Msg91SmsProvider(config).sendOtp('+919876543210', '123456', ''),
    ).rejects.toThrow();
  });
});
