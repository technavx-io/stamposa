import { normaliseInfoUrl } from './dto/business-info.dto';

describe('normaliseInfoUrl', () => {
  it('clears on empty input', () => {
    expect(normaliseInfoUrl('')).toBeNull();
    expect(normaliseInfoUrl('   ')).toBeNull();
    expect(normaliseInfoUrl(null)).toBeNull();
    expect(normaliseInfoUrl(undefined)).toBeNull();
  });

  it('keeps https URLs unchanged (bar the URL parser tidy)', () => {
    expect(normaliseInfoUrl('https://www.zomato.com/waffle-cafe/menu')).toBe(
      'https://www.zomato.com/waffle-cafe/menu',
    );
  });

  it('accepts http:// for local/dev links', () => {
    expect(normaliseInfoUrl('http://localhost:3000/menu.pdf')).toBe('http://localhost:3000/menu.pdf');
  });

  it('prepends https:// when the scheme is missing', () => {
    expect(normaliseInfoUrl('wafflecafe.in/menu')).toBe('https://wafflecafe.in/menu');
    // The URL constructor normalises a bare host to end with a slash.
    expect(normaliseInfoUrl('wafflecafe.in')).toBe('https://wafflecafe.in/');
  });

  it('rejects javascript: and data: URIs', () => {
    expect(() => normaliseInfoUrl('javascript:alert(1)')).toThrow(/not allowed/);
    expect(() => normaliseInfoUrl('  JavaScript:alert(1)')).toThrow(/not allowed/);
    expect(() => normaliseInfoUrl('data:text/html,<h1>x</h1>')).toThrow(/not allowed/);
  });

  it('rejects gibberish that will not parse as a URL', () => {
    expect(() => normaliseInfoUrl('  ')).not.toThrow();
    expect(() => normaliseInfoUrl('http://')).toThrow(/link/);
  });
});

// A slim in-memory Prisma double so we exercise updateInfo without a live DB.
type Data = Record<string, unknown>;
function makePrisma(initial: Data) {
  let stored: Data = { ...initial };
  return {
    business: {
      update: jest.fn(async ({ data }: { data: Data }) => {
        stored = { ...stored, ...data };
        return stored;
      }),
      findUnique: jest.fn(async () => stored),
    },
    _get: () => stored,
  };
}

describe('BusinessesService.updateInfo', () => {
  // Imported lazily so the module doesn't need real deps at describe time.
  const { BusinessesService } = require('./businesses.service');

  const makeService = (initial: Data = { id: 'biz_1' }) => {
    const prisma = makePrisma(initial);
    // Only prisma is exercised — the other injected deps are unused here.
    const service = new BusinessesService(
      prisma as unknown as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, prisma };
  };

  it('persists valid fields and coerces empty strings to null', async () => {
    const { service, prisma } = makeService({
      id: 'biz_1',
      menuUrl: 'https://old.example.com/menu',
      aboutText: 'stale about',
    });
    await service.updateInfo('biz_1', {
      menuUrl: 'https://www.zomato.com/waffle',
      aboutText: '   ',
      address: '  12 MG Road  ',
      phone: '+91 80 1234 5678',
      websiteUrl: 'wafflecafe.in',
      hoursText: 'Mon–Sat · 10am–10pm',
      contactEmail: 'hi@wafflecafe.in',
      googleMapsUrl: 'https://maps.app.goo.gl/abc',
      instagramUrl: 'https://instagram.com/wafflecafe',
    });
    const patch = prisma.business.update.mock.calls[0][0].data;
    expect(patch).toMatchObject({
      menuUrl: 'https://www.zomato.com/waffle',
      aboutText: null,
      address: '12 MG Road',
      phone: '+91 80 1234 5678',
      websiteUrl: 'https://wafflecafe.in/',
      hoursText: 'Mon–Sat · 10am–10pm',
      contactEmail: 'hi@wafflecafe.in',
      googleMapsUrl: 'https://maps.app.goo.gl/abc',
      instagramUrl: 'https://instagram.com/wafflecafe',
    });
  });

  it('trims and normalises all social URLs (empty → null)', async () => {
    const { service, prisma } = makeService({ id: 'biz_1' });
    await service.updateInfo('biz_1', {
      instagramUrl: '  instagram.com/wafflecafe  ',
      facebookUrl: 'https://facebook.com/wafflecafe',
      youtubeUrl: 'youtube.com/@wafflecafe',
      xUrl: '',
      linkedinUrl: '   ',
      tiktokUrl: 'https://tiktok.com/@wafflecafe',
      whatsappUrl: 'https://wa.me/919876543210',
    });
    const patch = prisma.business.update.mock.calls[0][0].data;
    expect(patch).toMatchObject({
      instagramUrl: 'https://instagram.com/wafflecafe',
      facebookUrl: 'https://facebook.com/wafflecafe',
      youtubeUrl: 'https://youtube.com/@wafflecafe',
      xUrl: null,
      linkedinUrl: null,
      tiktokUrl: 'https://tiktok.com/@wafflecafe',
      whatsappUrl: 'https://wa.me/919876543210',
    });
  });

  it('rejects a javascript: menuUrl', async () => {
    const { service } = makeService();
    await expect(
      service.updateInfo('biz_1', { menuUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow(/not allowed/);
  });

  it('leaves untouched fields alone', async () => {
    const { service, prisma } = makeService({ id: 'biz_1', menuUrl: 'https://keep.me/menu' });
    await service.updateInfo('biz_1', { aboutText: 'new' });
    const patch = prisma.business.update.mock.calls[0][0].data;
    expect(patch.menuUrl).toBeUndefined();
    expect(patch.aboutText).toBe('new');
  });
});
