import Link from 'next/link';
import { ArrowRight, ShieldCheck, Smartphone, Stamp, Store, UserRound } from 'lucide-react';

import { siteHref } from '@stamposa/ui/lib/hosts';

/**
 * Home of the app host. In production the middleware sends "/" to the
 * marketing site, so this page is only reached in local development or if
 * the site origin is not configured. It is a plain switchboard: which door
 * do you want?
 */
const doors = [
  {
    href: '/merchant/login',
    icon: Store,
    title: 'Merchant',
    text: 'Run your loyalty program: dashboard, customers, rewards, analytics.',
  },
  {
    href: '/staff/login',
    icon: UserRound,
    title: 'Counter staff',
    text: 'Stamp cards, enrol customers and hand over rewards at the till.',
  },
  {
    href: '/my-cards',
    icon: Smartphone,
    title: 'Customer',
    text: 'See every loyalty card you hold, in one place.',
  },
  {
    href: '/admin/login',
    icon: ShieldCheck,
    title: 'Platform admin',
    text: 'Stamposa operations. Two-factor required.',
  },
] as const;

export default function AppHomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-5 py-16">
      <p className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-strong">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Stamp className="size-4" />
        </span>
        Stamposa
      </p>
      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight text-strong sm:text-4xl">
        Sign in
      </h1>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-body">
        This is the app. Looking for what Stamposa is and how it works? That lives on{' '}
        <Link href={siteHref('/')} className="font-medium text-brand-600 hover:text-brand-700">
          the website
        </Link>
        .
      </p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {doors.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand-300 dark:hover:border-brand-500/40"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <d.icon className="size-4.5" aria-hidden />
              </span>
              <span className="mt-3.5 font-display text-[17px] font-medium text-strong">{d.title}</span>
              <span className="mt-1.5 flex-1 text-[14px] leading-relaxed text-body">{d.text}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-brand-600 dark:text-brand-300">
                Continue <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
