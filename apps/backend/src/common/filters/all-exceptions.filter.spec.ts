import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { conflict, serviceUnavailable } from '../exceptions';
import { AllExceptionsFilter } from './all-exceptions.filter';

jest.mock('@sentry/node', () => ({
  withScope: jest.fn((fn: (scope: unknown) => void) =>
    fn({ setTag: jest.fn(), setContext: jest.fn(), setUser: jest.fn() }),
  ),
  captureException: jest.fn(),
}));

function makeHost(overrides: Record<string, unknown> = {}) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  const req = { id: 'req-1', method: 'POST', url: '/v1/x?q=1', ...overrides };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('AllExceptionsFilter + monitoring', () => {
  beforeEach(() => jest.clearAllMocks());
  const filter = new AllExceptionsFilter();

  it('reports 5xx to Sentry with the request id', () => {
    const { host, res } = makeHost();
    filter.catch(serviceUnavailable('SMS_SEND_FAILED', 'gateway down'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('reports unknown crashes as 500', () => {
    const { host, res } = makeHost();
    filter.catch(new Error('boom'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('keeps expected domain errors (4xx) out of monitoring', () => {
    const { host, res } = makeHost();
    filter.catch(conflict('ALREADY_REDEEMED', 'nope'), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('still renders the error envelope', () => {
    const { host, res } = makeHost();
    filter.catch(conflict('ALREADY_REDEEMED', 'nope'), host);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ALREADY_REDEEMED', requestId: 'req-1' }),
    );
  });
});
