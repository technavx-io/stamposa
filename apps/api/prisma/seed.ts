/**
 * Development seed — wipes and repopulates the database with two demo tenants
 * so multi-tenant isolation is visible from the first login.
 *
 * Demo accounts (password for all: password123):
 *   Merchant (Brew & Bean) : owner@brewbean.com
 *   Staff    (Brew & Bean) : ravi@brewbean.com, meera@brewbean.com (manager)
 *   Merchant (Glow Salon)  : owner@glowsalon.com
 *   Customers keep phone + OTP: +91 98765 01101 … 01108 (code shown on screen)
 */
import { AdminRole, PrismaClient, RedemptionStatus, StampIssuerType } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomInt } from 'crypto';

const prisma = new PrismaClient();

// Deterministic PRNG so re-seeding produces the same demo story.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260804);

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function membershipCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return out;
}

function daysAgo(days: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, Math.floor(rand() * 60), 0);
  return d;
}

async function main() {
  console.log('Clearing existing data…');
  await prisma.auditLog.deleteMany();
  await prisma.impersonationSession.deleteMany();
  await prisma.platformAdmin.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.stamp.deleteMany();
  await prisma.customerMembership.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.business.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchant.deleteMany();

  // Every demo account shares one password so the login screen is easy.
  const demoHash = await hash('password123');

  console.log('Seeding Brew & Bean Coffee…');
  const merchant = await prisma.merchant.create({
    data: { email: 'owner@brewbean.com', passwordHash: demoHash, phone: '+919876500001', name: 'Asha Patel' },
  });
  const business = await prisma.business.create({
    data: {
      merchantId: merchant.id,
      name: 'Brew & Bean Coffee',
      slug: 'brew-and-bean',
      address: '12 MG Road, Indiranagar, Bengaluru 560038',
      phone: '+919876500011',
    },
  });
  const campaign = await prisma.campaign.create({
    data: {
      businessId: business.id,
      name: 'Coffee Lovers Card',
      description: 'Collect a stamp with every coffee. Ten stamps and the next one is on us.',
      stampsRequired: 10,
      reward: '1 free coffee of your choice',
    },
  });
  const staffRavi = await prisma.staff.create({
    data: { businessId: business.id, email: 'ravi@brewbean.com', passwordHash: demoHash, phone: '+919876500002', name: 'Ravi Kumar' },
  });
  const staffMeera = await prisma.staff.create({
    data: { businessId: business.id, email: 'meera@brewbean.com', passwordHash: demoHash, phone: '+919876500003', name: 'Meera Iyer', role: 'MANAGER' },
  });
  const staffPool = [staffRavi, staffMeera];

  const customerSpecs: Array<{ phone: string; name: string; totalStamps: number }> = [
    { phone: '+919876501101', name: 'Aarav Shah', totalStamps: 24 },
    { phone: '+919876501102', name: 'Priya Nair', totalStamps: 17 },
    { phone: '+919876501103', name: 'Rohan Mehta', totalStamps: 9 },
    { phone: '+919876501104', name: 'Sneha Reddy', totalStamps: 12 },
    { phone: '+919876501105', name: 'Kabir Singh', totalStamps: 6 },
    { phone: '+919876501106', name: 'Ananya Das', totalStamps: 31 },
    { phone: '+919876501107', name: 'Vikram Joshi', totalStamps: 3 },
    { phone: '+919876501108', name: 'Isha Kapoor', totalStamps: 1 },
  ];

  const customers = [] as { id: string; phone: string }[];
  for (const spec of customerSpecs) {
    const customer = await prisma.customer.create({
      data: { phone: spec.phone, name: spec.name },
    });
    customers.push({ id: customer.id, phone: spec.phone });

    // Spread the customer's stamps over the past ~45 days, oldest first.
    const stampDays = Array.from({ length: spec.totalStamps }, () => Math.floor(rand() * 45))
      .sort((a, b) => b - a);
    const joinedAt = daysAgo(stampDays.length > 0 ? stampDays[0] + Math.floor(rand() * 5) + 1 : 10, 10, 0);

    const membership = await prisma.customerMembership.create({
      data: {
        code: membershipCode(),
        customerId: customer.id,
        businessId: business.id,
        campaignId: campaign.id,
        createdAt: joinedAt,
        stampCount: spec.totalStamps % campaign.stampsRequired,
        completedCount: Math.floor(spec.totalStamps / campaign.stampsRequired),
        totalStamps: spec.totalStamps,
      },
    });

    let lastStampAt: Date | null = null;
    for (let i = 0; i < spec.totalStamps; i++) {
      const at = daysAgo(stampDays[i], 8 + Math.floor(rand() * 13), Math.floor(rand() * 60));
      if (!lastStampAt || at > lastStampAt) lastStampAt = at;
      const staff = staffPool[Math.floor(rand() * staffPool.length)];
      await prisma.stamp.create({
        data: {
          membershipId: membership.id,
          businessId: business.id,
          issuerType: StampIssuerType.STAFF,
          staffId: staff.id,
          completedCard: (i + 1) % campaign.stampsRequired === 0,
          createdAt: at,
        },
      });
    }
    if (lastStampAt) {
      await prisma.customerMembership.update({
        where: { id: membership.id },
        data: { lastStampAt },
      });
    }
  }

  console.log('Seeding Glow Salon (second tenant — proves isolation)…');
  const merchant2 = await prisma.merchant.create({
    data: { email: 'owner@glowsalon.com', passwordHash: demoHash, phone: '+919876500004', name: 'Priya Sharma' },
  });
  const business2 = await prisma.business.create({
    data: {
      merchantId: merchant2.id,
      name: 'Glow Salon',
      slug: 'glow-salon',
      address: '4th Block, Koramangala, Bengaluru 560034',
      phone: '+919876500044',
    },
  });
  const campaign2 = await prisma.campaign.create({
    data: {
      businessId: business2.id,
      name: 'Pamper Points',
      description: 'Every visit earns a stamp. Eight visits, one treat on the house.',
      stampsRequired: 8,
      reward: 'Free blow-dry & style',
    },
  });
  const staffZara = await prisma.staff.create({
    data: { businessId: business2.id, email: 'zara@glowsalon.com', passwordHash: demoHash, phone: '+919876500005', name: 'Zara Khan' },
  });

  // Aarav is a customer at BOTH businesses — one global identity, two cards.
  const sharedCustomer = customers[0];
  const salonCustomers = [
    sharedCustomer,
    await prisma.customer
      .create({ data: { phone: '+919876501201', name: 'Divya Menon' } })
      .then((c) => ({ id: c.id, phone: c.phone })),
  ];
  for (const [idx, c] of salonCustomers.entries()) {
    const total = idx === 0 ? 5 : 11;
    const stampDays = Array.from({ length: total }, () => Math.floor(rand() * 30)).sort((a, b) => b - a);
    const membership = await prisma.customerMembership.create({
      data: {
        code: membershipCode(),
        customerId: c.id,
        businessId: business2.id,
        campaignId: campaign2.id,
        createdAt: daysAgo(stampDays[0] + 2, 11, 0),
        stampCount: total % campaign2.stampsRequired,
        completedCount: Math.floor(total / campaign2.stampsRequired),
        totalStamps: total,
      },
    });
    let lastStampAt: Date | null = null;
    for (let i = 0; i < total; i++) {
      const at = daysAgo(stampDays[i], 10 + Math.floor(rand() * 9), Math.floor(rand() * 60));
      if (!lastStampAt || at > lastStampAt) lastStampAt = at;
      await prisma.stamp.create({
        data: {
          membershipId: membership.id,
          businessId: business2.id,
          issuerType: StampIssuerType.STAFF,
          staffId: staffZara.id,
          completedCard: (i + 1) % campaign2.stampsRequired === 0,
          createdAt: at,
        },
      });
    }
    if (lastStampAt) {
      await prisma.customerMembership.update({ where: { id: membership.id }, data: { lastStampAt } });
    }
  }

  console.log('Minting reward vouchers for completed cards…');
  const completingStamps = await prisma.stamp.findMany({
    where: { completedCard: true },
    include: { membership: { include: { campaign: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const now = new Date();
  for (const s of completingStamps) {
    // Historical completions are recorded as honoured shortly after earning.
    const redeemedAt = new Date(
      Math.min(now.getTime(), s.createdAt.getTime() + (1 + Math.floor(rand() * 48)) * 3_600_000),
    );
    await prisma.redemption.create({
      data: {
        code: membershipCode(),
        membershipId: s.membershipId,
        businessId: s.businessId,
        rewardText: s.membership.campaign.reward,
        earnedByStampId: s.id,
        status: RedemptionStatus.REDEEMED,
        redeemedAt,
        redeemedByType: StampIssuerType.STAFF,
        redeemedStaffId: s.staffId,
        createdAt: s.createdAt,
      },
    });
  }
  // Leave the most recent voucher per business pending — demo the redeem flow.
  for (const bizId of [business.id, business2.id]) {
    const latest = await prisma.redemption.findFirst({
      where: { businessId: bizId },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) {
      await prisma.redemption.update({
        where: { id: latest.id },
        data: {
          status: RedemptionStatus.PENDING,
          redeemedAt: null,
          redeemedByType: null,
          redeemedStaffId: null,
        },
      });
    }
  }

  console.log('Seeding platform admins…');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const passwordHash = await hash(adminPassword);
  await prisma.platformAdmin.createMany({
    data: [
      {
        email: 'owner@stamposa.com',
        name: 'Platform Owner',
        role: AdminRole.SUPER_ADMIN,
        passwordHash,
      },
      {
        email: 'ops@stamposa.com',
        name: 'Ops Admin',
        role: AdminRole.OPS,
        passwordHash,
      },
      {
        email: 'support@stamposa.com',
        name: 'Support Agent',
        role: AdminRole.SUPPORT,
        passwordHash,
      },
    ],
  });
  console.log(`  admin sign-in:    owner@stamposa.com / ${adminPassword}`);
  console.log('  merchant sign-in: owner@brewbean.com / password123');
  console.log('  staff sign-in:    ravi@brewbean.com / password123 (Meera = manager)');

  const counts = {
    merchants: await prisma.merchant.count(),
    businesses: await prisma.business.count(),
    campaigns: await prisma.campaign.count(),
    staff: await prisma.staff.count(),
    customers: await prisma.customer.count(),
    memberships: await prisma.customerMembership.count(),
    stamps: await prisma.stamp.count(),
    redemptions: await prisma.redemption.count(),
    pendingRewards: await prisma.redemption.count({ where: { status: 'PENDING' } }),
    platformAdmins: await prisma.platformAdmin.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
