import { Business } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { BroadcastService } from './broadcast.service';

function business(overrides: Partial<Business> = {}): Business {
  return { id: 'biz_1', suspendedAt: null, ...(overrides as object) } as Business;
}

function makeService(opts: {
  passHolders?: number;
  sentToday?: number;
  sentThisMonth?: number;
}) {
  const created = { id: 'bc_1', title: 'T', body: 'B', status: 'QUEUED', recipientCount: 0, appleDevices: 0, googleNotified: false, sentAt: null, createdAt: new Date() };
  const prisma = {
    broadcast: {
      // First count call = today, second = month (Promise.all order in send()).
      count: jest
        .fn()
        .mockResolvedValueOnce(opts.sentToday ?? 0)
        .mockResolvedValueOnce(opts.sentThisMonth ?? 0),
      create: jest.fn().mockResolvedValue(created),
      update: jest.fn().mockResolvedValue(created),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
  const wallet = {
    reachableCount: jest
      .fn()
      .mockResolvedValue({ passHolders: opts.passHolders ?? 5, appleDevices: 4, googleCards: 1 }),
    broadcast: jest
      .fn()
      .mockResolvedValue({ recipientCount: 5, appleDevices: 4, googleNotified: true }),
  } as unknown as WalletService;
  return { service: new BroadcastService(prisma, wallet), prisma, wallet, created };
}

const dto = { title: 'Weekend offer', body: '20% off Saturday' };

describe('BroadcastService.send', () => {
  it('refuses when the account is suspended', async () => {
    const { service } = makeService({});
    await expect(service.send(business({ suspendedAt: new Date() }), dto)).rejects.toMatchObject({
      response: { code: 'BUSINESS_SUSPENDED' },
    });
  });

  it('refuses when no one has added the card to a wallet', async () => {
    const { service } = makeService({ passHolders: 0 });
    await expect(service.send(business(), dto)).rejects.toMatchObject({
      response: { code: 'NO_WALLET_AUDIENCE' },
    });
  });

  it('enforces the daily anti-spam cap', async () => {
    const { service } = makeService({ sentToday: 5 });
    await expect(service.send(business(), dto)).rejects.toMatchObject({
      response: { code: 'BROADCAST_DAILY_CAP' },
    });
  });

  it('creates a queued row and dispatches on the happy path', async () => {
    const { service, prisma, wallet } = makeService({ passHolders: 5 });
    const res = await service.send(business(), dto);
    expect(res.status).toBe('QUEUED');
    expect(prisma.broadcast.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipientCount: 5 }) }),
    );
    // Let the fire-and-forget dispatch settle.
    await new Promise((r) => setImmediate(r));
    expect(wallet.broadcast).toHaveBeenCalledWith('biz_1', expect.objectContaining({ id: 'bc_1' }));
  });
});
