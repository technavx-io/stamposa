import type { Metadata } from 'next';
import type { Plan } from '@/lib/api/types';
import { PlanGrid } from '@/components/billing/plan-grid';
import { SiteHeader, SiteFooter } from '@/components/marketing/site-chrome';
import { appHref } from '@/lib/hosts';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple, honest pricing for digital loyalty cards. Start free, upgrade when you want to reach customers. Apple & Google Wallet on every plan.',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

async function getPlans(): Promise<Plan[]> {
  const res = await fetch(`${API_BASE}/v1/public/plans`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error('Could not load plans');
  return res.json();
}

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. Every new business gets 30 days of Growth free, no card required. After the trial you drop to the Free plan automatically — your cards keep working.',
  },
  {
    q: 'What are wallet broadcasts?',
    a: 'A message you push straight to your customers’ Apple & Google Wallet passes — it lands on their lock screen. No SMS cost, no app to install.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes, upgrade or downgrade anytime. Yearly plans give you two months free versus paying monthly.',
  },
  {
    q: 'How is tax handled?',
    a: 'Prices are shown excluding tax. Our payment provider is the merchant of record, so the exact GST (or local tax for international customers) is calculated and shown at checkout, and they handle remitting it.',
  },
];

export default async function PricingPage() {
  const plans = await getPlans();

  return (
    <div className="min-h-dvh bg-canvas">
      <SiteHeader active="pricing" />

      <main className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-strong sm:text-5xl">
            Pricing that grows with you
          </h1>
          <p className="mt-4 text-lg text-muted">
            Start free, upgrade when you’re ready to reach customers. Apple &amp; Google Wallet on
            every plan — no app for your customers to download.
          </p>
        </div>

        <div className="mt-14">
          <PlanGrid plans={plans} signupHref={appHref('/merchant/login')} />
        </div>

        <p className="mt-6 text-center text-[13px] text-muted">
          A third of the price of the big loyalty platforms. No setup fees.
        </p>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-2xl">
          <h2 className="text-center font-display text-2xl font-semibold text-strong">
            Questions
          </h2>
          <dl className="mt-8 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-line/80 bg-surface p-5">
                <dt className="font-medium text-strong">{item.q}</dt>
                <dd className="mt-1.5 text-[14px] text-body">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
