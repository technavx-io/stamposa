/**
 * Production admin bootstrap — idempotent and non-destructive.
 *
 * Creates the three platform-admin accounts if (and only if) they don't
 * already exist. Unlike prisma/seed.ts — a DEV seed that WIPES the database
 * and plants two demo tenants — this touches nothing else: no wipe, no demo
 * data, and it never overwrites an existing admin. That makes it safe to run
 * on every deploy, including after someone has changed their password.
 *
 *   SEED_ADMIN_PASSWORD sets the INITIAL password for any account it creates.
 *   Sign in once, enrol 2FA (mandatory in production), and change it.
 *
 * Run:  npm run -w apps/api prisma:seed:admins
 */
import { AdminRole, PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const ADMINS = [
  { email: 'owner@stamposa.com', name: 'Platform Owner', role: AdminRole.SUPER_ADMIN },
  { email: 'ops@stamposa.com', name: 'Ops Admin', role: AdminRole.OPS },
  { email: 'support@stamposa.com', name: 'Support Agent', role: AdminRole.SUPPORT },
] as const;

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const passwordHash = await hash(password);

  let created = 0;
  for (const admin of ADMINS) {
    const existing = await prisma.platformAdmin.findUnique({
      where: { email: admin.email },
    });
    if (existing) continue;
    await prisma.platformAdmin.create({ data: { ...admin, passwordHash } });
    created += 1;
  }

  const total = await prisma.platformAdmin.count();
  console.log(`✓ Platform admins ready — ${created} created, ${total} total.`);
  if (created > 0) {
    console.log(
      '  Sign in: owner@stamposa.com / <SEED_ADMIN_PASSWORD> — then enrol 2FA and change the password.',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
