import { AppConfigService } from '../config/app-config.service';
import { ApplePassService, hexToRgb, PassMembership } from './apple-pass.service';
import { GoogleWalletService } from './google-wallet.service';
import { renderStampCard } from './stamp-card-image';

const fakeConfig = {
  apiPublicUrl: 'https://api.example.com',
  webAppUrl: 'https://app.example.com',
  appleWallet: {
    certPath: '/dev/null',
    keyPath: '/dev/null',
    wwdrPath: '/dev/null',
    teamId: 'TEAM123456',
    passTypeId: 'pass.com.stamposa.loyalty',
  },
  googleWallet: { issuerId: '3388000000000000000', saKeyPath: '/dev/null' },
} as unknown as AppConfigService;

function membership(overrides: Partial<PassMembership> = {}): PassMembership {
  return {
    id: 'mem_1',
    code: 'AB2CD3EF',
    customerId: 'cust_1',
    businessId: 'biz_1',
    campaignId: 'camp_1',
    stampCount: 4,
    completedCount: 1,
    totalStamps: 14,
    lastStampAt: new Date(),
    notes: null,
    tags: [],
    blockedAt: null,
    blockedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    business: {
      id: 'biz_1',
      merchantId: 'mer_1',
      name: 'Brew & Bean',
      slug: 'brew-and-bean',
      logoPath: '/uploads/logos/x.png',
      address: '1 Lane',
      phone: null,
      suspendedAt: null,
      suspendedReason: null,
      suspendedById: null,
      adminNotes: null,
      brandColor: '#0D9488',
      category: null,
      timezone: 'Asia/Kolkata',
      consentText: null,
      consentTextVersion: 1,
      notifyDailySummary: true,
      notifyWeeklyDigest: true,
      notifyStaffInactive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    campaign: {
      id: 'camp_1',
      businessId: 'biz_1',
      name: 'Coffee Card',
      description: null,
      stampsRequired: 10,
      reward: 'Free coffee',
      status: 'ACTIVE',
      dailyStampCap: null,
      terms: 'One stamp per visit.',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    customer: {
      id: 'cust_1',
      phone: '+919876501101',
      name: 'Aarav Shah',
      erasedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    redemptions: [],
    ...overrides,
  } as PassMembership;
}

describe('hexToRgb', () => {
  it('converts 6-digit hex', () => {
    expect(hexToRgb('#0D9488')).toBe('rgb(13,148,136)');
  });
  it('expands 3-digit hex', () => {
    expect(hexToRgb('#fff')).toBe('rgb(255,255,255)');
  });
  it('falls back to brand colour on garbage', () => {
    expect(hexToRgb('teal')).toBe('rgb(79,70,229)');
  });
});

describe('ApplePassService.buildPassJson', () => {
  const service = new ApplePassService(fakeConfig);

  it('renders an in-progress card', () => {
    const pass = service.buildPassJson(membership(), 'tok123') as any;
    expect(pass.serialNumber).toBe('mem_1');
    expect(pass.teamIdentifier).toBe('TEAM123456');
    expect(pass.webServiceURL).toBe('https://api.example.com/v1/wallet/apple');
    expect(pass.authenticationToken).toBe('tok123');
    expect(pass.backgroundColor).toBe('rgb(13,148,136)');
    // Count moved to a header field so the strip image (the stamp visual) is
    // the hero of the card rather than being overlaid by a big number.
    expect(pass.storeCard.primaryFields).toEqual([]);
    expect(pass.storeCard.headerFields[0].value).toBe('4/10');
    expect(pass.storeCard.secondaryFields[0].value).toBe('6 more · Free coffee');
    expect(pass.barcodes[0].message).toBe('AB2C-D3EF');
    expect(pass.storeCard.backFields.some((f: any) => f.key === 'terms')).toBe(true);
  });

  it('surfaces a waiting reward', () => {
    const pass = service.buildPassJson(
      membership({
        redemptions: [
          {
            id: 'red_1',
            code: 'RRRR2222',
            membershipId: 'mem_1',
            businessId: 'biz_1',
            rewardText: 'Free coffee',
            earnedByStampId: null,
            status: 'PENDING',
            redeemedAt: null,
            redeemedByType: null,
            redeemedStaffId: null,
            voidedAt: null,
            voidReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }),
      'tok',
    ) as any;
    expect(pass.storeCard.secondaryFields[0].label).toBe('REWARD READY');
    expect(pass.storeCard.secondaryFields[0].value).toBe('Free coffee');
  });
});

describe('GoogleWalletService builders', () => {
  const service = new GoogleWalletService(fakeConfig);

  it('builds a loyalty object keyed by issuer + membership', () => {
    const obj = service.buildObject(membership()) as any;
    expect(obj.id).toBe('3388000000000000000.card_mem_1');
    expect(obj.classId).toBe('3388000000000000000.biz_biz_1');
    expect(obj.loyaltyPoints.balance.string).toBe('4 / 10');
    expect(obj.secondaryLoyaltyPoints.balance.string).toBe('0');
    expect(obj.barcode.value).toBe('AB2C-D3EF');
    expect(obj.accountName).toBe('Aarav Shah');
  });

  it('builds the class with brand colour and hosted logo', () => {
    const m = membership();
    const cls = service.buildClass(m.business, m.campaign) as any;
    expect(cls.hexBackgroundColor).toBe('#0D9488');
    expect(cls.programName).toBe('Coffee Card');
    expect(cls.programLogo.sourceUri.uri).toBe('https://api.example.com/uploads/logos/x.png');
  });

  it('falls back to the bundled Stamposa logo when the business has none', () => {
    // Google Wallet rejects a class with no programLogo, so a logo-less
    // merchant must still get a valid (branded) default — otherwise their
    // customers' passes silently never load.
    const m = membership();
    const cls = service.buildClass({ ...m.business, logoPath: null }, m.campaign) as any;
    expect(cls.programLogo.sourceUri.uri).toBe('https://api.example.com/assets/wallet/logo.png');
    expect(cls.programLogo.contentDescription.defaultValue.value).toBe('Stamposa');
  });

  it('attaches a stamp-progress hero image, cache-busted by the count', () => {
    const obj = service.buildObject(membership()) as any;
    // The ?v= must be the current stamp count so Google re-fetches the banner
    // when progress changes instead of serving a stale cached image.
    expect(obj.heroImage.sourceUri.uri).toBe(
      'https://api.example.com/v1/customer/cards/mem_1/wallet/hero.png?v=4',
    );
  });
});

describe('renderStampCard', () => {
  it('produces a valid PNG (magic bytes) at the requested size', () => {
    const png = renderStampCard({
      stampCount: 3,
      stampsRequired: 4,
      brandColorHex: '#4F46E5',
      width: 750,
      height: 246,
    });
    // PNG signature.
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    // IHDR width/height are big-endian uint32 at offsets 16 and 20.
    expect(png.readUInt32BE(16)).toBe(750);
    expect(png.readUInt32BE(20)).toBe(246);
  });

  it('handles a zero-progress card and a fully-stamped card without throwing', () => {
    expect(() =>
      renderStampCard({ stampCount: 0, stampsRequired: 8, brandColorHex: '#FBBF24', width: 400, height: 200 }),
    ).not.toThrow();
    expect(() =>
      renderStampCard({ stampCount: 10, stampsRequired: 10, brandColorHex: '#0D9488', width: 400, height: 200 }),
    ).not.toThrow();
  });

  it('composites the merchant stamp + reward emoji when set', () => {
    // A café's ☕ / 🎁 card — the composite path (bundled Twemoji PNGs) must run
    // and still yield a valid image.
    const png = renderStampCard({
      stampCount: 3,
      stampsRequired: 6,
      brandColorHex: '#6D4534',
      width: 1032,
      height: 336,
      stampIcon: '☕',
      rewardIcon: '🎁',
    });
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1032);
  });

  it('falls back to a plain disc for an emoji outside the bundled set', () => {
    // Not a preset (and no bundled PNG): must degrade to the disc, not throw.
    expect(() =>
      renderStampCard({
        stampCount: 2,
        stampsRequired: 4,
        brandColorHex: '#4F46E5',
        width: 400,
        height: 200,
        stampIcon: '🦄',
        rewardIcon: '🛸',
      }),
    ).not.toThrow();
  });
});
