import { AppConfigService } from '../config/app-config.service';
import { ApplePassService, hexToRgb, PassMembership } from './apple-pass.service';
import { GoogleWalletService } from './google-wallet.service';

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
    expect(pass.storeCard.primaryFields[0].value).toBe('4 of 10');
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
});
