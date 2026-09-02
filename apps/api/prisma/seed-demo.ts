/**
 * Demo business bootstrap — idempotent and non-destructive.
 *
 * The marketing site's "Try a demo card" button links to /join/brew-and-bean.
 * That business only ever existed in the DEV seed (prisma/seed.ts, which wipes
 * everything), so in production the link 404s. This creates a persistent demo
 * café — Brew & Bean, the same one the marketing hero shows — so a visitor can
 * actually experience the join flow.
 *
 * Safe to run on every deploy: it does nothing if the business already exists,
 * never wipes, and never touches real merchant data.
 *
 *   npm run -w apps/api prisma:seed:demo
 */
import { CampaignStatus, PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const SLUG = 'brew-and-bean';

async function main() {
  const existing = await prisma.business.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`✓ Demo business "${SLUG}" already exists — nothing to do.`);
    return;
  }

  // A self-contained demo account. The password is unimportant — the demo is
  // the customer join experience, not merchant login — but it's a real,
  // verified account so nothing about it looks half-built in the admin panel.
  const passwordHash = await hash(process.env.SEED_DEMO_PASSWORD ?? 'StamposaDemo!2026');

  const merchant = await prisma.merchant.create({
    data: {
      email: 'demo@stamposa.com',
      passwordHash,
      emailVerifiedAt: new Date(),
      name: 'Brew & Bean (Demo)',
    },
  });

  const business = await prisma.business.create({
    data: {
      merchantId: merchant.id,
      name: 'Brew & Bean Coffee',
      slug: SLUG,
      address: '12 MG Road, Indiranagar, Bengaluru 560038',
    },
  });

  await prisma.campaign.create({
    data: {
      businessId: business.id,
      name: 'Coffee Lovers Card',
      description: 'Collect a stamp with every coffee. Ten stamps and the next one is on us.',
      stampsRequired: 10,
      reward: '1 free coffee of your choice',
      status: CampaignStatus.ACTIVE,
      cardColor: '#6D4534',
      stampIcon: '☕',
      rewardIcon: '🎁',
    },
  });

  console.log(`✓ Demo business "${SLUG}" created — the "Try a demo card" link now works.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
