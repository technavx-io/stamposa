import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  Download,
  Gift,
  Newspaper,
  QrCode,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Stamp,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggleCompact } from '@/components/ui/theme-toggle';
import { CounterDemo } from '@/components/marketing/counter-demo';
import { StampDemo } from '@/components/marketing/stamp-demo';

import { appHref } from '@/lib/hosts';

/** Everything a shop gets, grouped by the person who touches it. */
const roles = [
  {
    key: 'owner',
    eyebrow: 'For the owner',
    title: 'See the shop without standing in it',
    body: 'Today’s stamps, who is coming back, which rewards are waiting to be handed over. Every number is a real count from the counter, not an estimate.',
    points: [
      'Dashboard with today’s activity as it happens',
      '7, 30 and 90-day trends against the period before',
      'Customer list with visit history you can export any time',
      'A ledger of every stamp and correction, with who made it',
    ],
    shot: '/screens/merchant-dashboard.png',
    shotAlt: 'Stamposa merchant dashboard showing today’s stamps, live activity and campaign status',
    wide: true,
  },
  {
    key: 'counter',
    eyebrow: 'For the counter',
    title: 'Two taps, mid-queue',
    body: 'Staff sign in with their phone number. No terminal, no training. Scan the customer’s QR or type their name — the card comes up and one tap stamps it.',
    points: [
      'Camera scanning, or search by phone, name or code',
      'Enrol a new customer at the till without an OTP',
      '60-second undo for mistakes — 15 minutes for managers',
      'Hand over rewards and mark them redeemed on the spot',
    ],
    shot: '/screens/staff-console.png',
    shotAlt: 'Stamposa staff console on a phone showing customer search and add-stamp buttons',
    wide: false,
  },
  {
    key: 'customer',
    eyebrow: 'For the customer',
    title: 'No app. Ever.',
    body: 'They scan your QR, verify their number once, and the card is theirs. It updates while they watch, and it cannot be left at home or put through the wash.',
    points: [
      'Joins in under a minute from any phone',
      'Stamps appear live — no refresh, no waiting',
      'Add to Apple Wallet or Google Wallet in one tap',
      'Rewards show a code the counter can honour instantly',
    ],
    shot: '/screens/customer-card.png',
    shotAlt: 'A Stamposa customer loyalty card on a phone with stamps, QR code and wallet buttons',
    wide: false,
  },
] as const;

const included = [
  { icon: QrCode, title: 'One QR to join', text: 'Print the standee once. Every customer starts from the same scan.' },
  { icon: ScanLine, title: 'Camera scanning', text: 'Point the phone at the customer’s card. Works on iPhone and Android.' },
  { icon: RotateCcw, title: 'Undo mistakes', text: 'Take a stamp back within a minute. Managers get fifteen.' },
  { icon: Users, title: 'Your customer list', text: 'Names, numbers, visit history — exportable to CSV whenever you like.' },
  { icon: BarChart3, title: 'Honest analytics', text: 'Repeat rate, busiest days, and which staff member is stamping most.' },
  { icon: Gift, title: 'Reward tracking', text: 'Every earned reward is a voucher: waiting, handed over, or voided.' },
  { icon: Wallet, title: 'Wallet passes', text: 'Cards live in Apple and Google Wallet, updating after every visit.' },
  { icon: ShieldCheck, title: 'Fraud rails', text: 'Daily stamp caps and a full audit trail of every correction made.' },
  { icon: Download, title: 'Nothing locked in', text: 'Export your customers and history any time. The data is yours.' },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface text-strong">
      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-strong"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Stamp className="size-4" />
            </span>
            Stamposa
          </Link>
          <nav className="hidden items-center gap-7 text-[14px] text-body md:flex">
            <a href="#how" className="transition-colors hover:text-strong">How it works</a>
            <a href="#roles" className="transition-colors hover:text-strong">What you get</a>
            <a href="#included" className="transition-colors hover:text-strong">Features</a>
            <Link href="/guide" className="transition-colors hover:text-strong">Guide</Link>
            <Link href="/blog" className="transition-colors hover:text-strong">Blog</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggleCompact />
            <Link href={appHref("/staff/login")}>
              <Button variant="ghost" size="sm" className="whitespace-nowrap">Staff login</Button>
            </Link>
            <Link href={appHref("/merchant/login")}>
              <Button variant="brand" size="sm" className="whitespace-nowrap">Merchant sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 font-brand-mono text-[11px] tracking-widest text-brand-700 uppercase">
            <Stamp className="size-3" aria-hidden /> Digital stamp cards
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] leading-[1.04] font-semibold tracking-tight text-strong sm:text-6xl">
            Paper punch cards,
            <span className="block text-brand-600">without the paper.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-body">
            Stamposa runs the loyalty card for your café, salon or shop. Customers join by
            scanning one QR — no app to download. Staff stamp from any phone. You keep the
            customer list.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={appHref("/merchant/login")}>
              <Button variant="brand" size="lg" className="rounded-xl">
                Start your program <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href={appHref("/join/brew-and-bean")}>
              <Button variant="secondary" size="lg" className="rounded-xl">
                <ScanLine className="size-4" /> Try a demo card
              </Button>
            </Link>
          </div>
          <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-600" aria-hidden /> Live in five minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-600" aria-hidden /> No hardware to buy
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-600" aria-hidden /> No app for customers
            </span>
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <StampDemo />
        </div>
      </section>

      {/* ── What it replaces ──────────────────────────────────────────── */}
      <section className="border-y border-line/70 bg-paper-tint">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-14 sm:grid-cols-3">
          {[
            {
              before: 'Card left at home',
              after: 'The card is on their phone, and in their wallet app.',
            },
            {
              before: 'Stamps you cannot count',
              after: 'Every stamp is recorded with who added it and when.',
            },
            {
              before: 'No idea who your regulars are',
              after: 'A customer list with visit history you actually own.',
            },
          ].map((row) => (
            <div key={row.before}>
              <p className="font-brand-mono text-[11px] tracking-widest text-zinc-400 uppercase line-through decoration-zinc-300">
                {row.before}
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-body">{row.after}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works (a real sequence, hence numbered) ────────────── */}
      <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-strong sm:text-4xl">
            The same moment, from both sides of the counter
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-body">
            This is the whole product: a customer shows their card, a staff member taps once,
            and the stamp appears on the customer’s phone before they have put it back in
            their pocket.
          </p>
        </div>

        <div className="mt-12 rounded-3xl border border-line/80 bg-paper-tint p-6 sm:p-10">
          <CounterDemo />
        </div>
      </section>

      {/* ── Set-up strip ──────────────────────────────────────────────── */}
      <section className="border-y border-line/70 bg-ink">
        <div className="mx-auto w-full max-w-6xl px-5 py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Setting it up takes an afternoon at most
          </h2>
          <ol className="mt-9 grid gap-8 sm:grid-cols-3">
            {[
              {
                t: 'Create your card',
                d: 'Name the programme, pick how many stamps earn the reward, and write what they win.',
              },
              {
                t: 'Print the QR',
                d: 'Download the standee and put it on the counter. That one code is how every customer joins.',
              },
              {
                t: 'Add your staff',
                d: 'They sign in with their own phone number. Managers get undo powers and the team view.',
              },
            ].map((s, i) => (
              <li key={s.t}>
                <span className="font-brand-mono text-[11px] tracking-widest text-brand-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mt-2 font-display text-lg font-medium text-white">{s.t}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Roles, with real product screenshots ─────────────────────── */}
      <section id="roles" className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase">
            What you get
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-strong sm:text-4xl">
            Three people use it. Each gets their own screen.
          </h2>
        </div>

        <div className="mt-14 space-y-20">
          {roles.map((role, i) => (
            <div
              key={role.key}
              className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                i % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
              }`}
            >
              <div>
                <p className="font-brand-mono text-[11px] tracking-widest text-zinc-400 uppercase">
                  {role.eyebrow}
                </p>
                <h3 className="mt-2.5 font-display text-2xl font-semibold tracking-tight text-strong sm:text-3xl">
                  {role.title}
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-body">{role.body}</p>
                <ul className="mt-6 space-y-2.5">
                  {role.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[14px] text-body">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={role.wide ? '' : 'flex justify-center'}>
                {role.wide ? (
                  <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-ink/10">
                    <Image
                      src={role.shot}
                      alt={role.shotAlt}
                      width={1440}
                      height={900}
                      sizes="(max-width: 1024px) 100vw, 560px"
                      className="w-full"
                    />
                  </div>
                ) : (
                  <div className="w-[248px] overflow-hidden rounded-[2rem] border-[7px] border-ink bg-ink shadow-2xl shadow-ink/25">
                    <Image
                      src={role.shot}
                      alt={role.shotAlt}
                      width={390}
                      height={844}
                      sizes="248px"
                      className="w-full rounded-[1.5rem]"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Analytics highlight ──────────────────────────────────────── */}
      <section className="border-y border-line/70 bg-paper-tint">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase">
              Numbers you can trust
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-strong sm:text-4xl">
              Find out if it is actually working
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-body">
              Loyalty is only worth running if people come back. Stamposa shows your repeat
              rate, how each period compares to the one before, and which days are busy —
              counted in your own timezone, so a late close does not split one night in two.
            </p>
            <Link
              href={appHref("/merchant/login")}
              className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              See it with demo data <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line shadow-2xl shadow-ink/10">
            <Image
              src="/screens/merchant-analytics.png"
              alt="Stamposa analytics showing stamps, new customers, repeat rate and a daily activity chart"
              width={1440}
              height={980}
              sizes="(max-width: 1024px) 100vw, 660px"
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* ── Everything included ──────────────────────────────────────── */}
      <section id="included" className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
        <div className="max-w-2xl">
          <p className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase">
            Included
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-strong sm:text-4xl">
            Everything, for every shop
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-body">
            No feature gates on the things that matter. Exporting your own customer list is
            not a premium add-on.
          </p>
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {included.map((f) => (
            <div key={f.title}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <f.icon className="size-4.5" aria-hidden />
              </span>
              <p className="mt-3.5 font-display text-[17px] font-medium text-strong">{f.title}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-body">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Wallet ───────────────────────────────────────────────────── */}
      <section className="border-y border-line/70 bg-paper-tint">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase">
              Apple &amp; Google Wallet
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-strong sm:text-4xl">
              The card sits next to their boarding passes
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-body">
              One tap adds your loyalty card to Apple Wallet or Google Wallet — and it stays
              current. Every stamp your staff adds pushes to the pass within seconds, so the
              number on their phone is never stale.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-white">
                <Wallet className="size-4" aria-hidden /> Add to Apple Wallet
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-medium text-white">
                <Smartphone className="size-4" aria-hidden /> Save to Google Wallet
              </span>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="w-[230px] overflow-hidden rounded-[2rem] border-[7px] border-ink bg-ink shadow-2xl shadow-ink/25">
              <Image
                src="/screens/join-page.png"
                alt="The Stamposa join page a customer sees after scanning the shop’s QR code"
                width={390}
                height={844}
                sizes="230px"
                className="w-full rounded-[1.5rem]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
        <div className="rounded-3xl bg-ink px-6 py-14 text-center sm:px-14">
          <h2 className="mx-auto max-w-xl font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Put the punch cards in the bin
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-white/65">
            Set up your card, print the QR, and stamp your first customer today.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={appHref("/merchant/login")}>
              <Button variant="brand" size="lg" className="rounded-xl">
                Start your program <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href={appHref("/join/brew-and-bean")}>
              <Button
                size="lg"
                className="rounded-xl border border-white/25 bg-transparent text-white hover:bg-white/10"
              >
                See a customer card
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-display font-semibold text-strong">
              <span className="flex size-7 items-center justify-center rounded-md bg-brand-600 text-white">
                <Stamp className="size-3.5" />
              </span>
              Stamposa
            </p>
            <p className="mt-2 text-[13px] text-muted">
              Digital loyalty cards for cafés, salons and shops.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-body">
            <Link href="/guide" className="transition-colors hover:text-strong">
              <BookOpen className="mr-1.5 inline size-3.5" aria-hidden />Guide
            </Link>
            <Link href="/blog" className="transition-colors hover:text-strong">
              <Newspaper className="mr-1.5 inline size-3.5" aria-hidden />Blog
            </Link>
            <Link href={appHref("/merchant/login")} className="transition-colors hover:text-strong">
              <Store className="mr-1.5 inline size-3.5" aria-hidden />Merchant sign in
            </Link>
            <Link href={appHref("/staff/login")} className="transition-colors hover:text-strong">
              Staff login
            </Link>
            <Link href={appHref("/my-cards")} className="transition-colors hover:text-strong">
              My cards
            </Link>
          </nav>
        </div>
        <div className="border-t border-line/70">
          <p className="mx-auto w-full max-w-6xl px-5 py-5 text-[12.5px] text-muted">
            © {new Date().getFullYear()} Stamposa · stamposa.com
          </p>
        </div>
      </footer>
    </div>
  );
}
