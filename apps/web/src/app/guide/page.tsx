import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Gift,
  Info,
  Newspaper,
  QrCode,
  ScanLine,
  ShoppingBag,
  Smartphone,
  Stamp,
  Store,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggleCompact } from '@/components/ui/theme-toggle';

import { appHref } from '@/lib/hosts';

export const metadata: Metadata = {
  title: 'Guide',
  description:
    'How Stamposa works, step by step — for business owners, counter staff and customers.',
};

/* ── Small inline building blocks ──────────────────────────────────────── */

/** A quoted on-screen label (a field, tab or menu item). */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <code className="mx-px whitespace-nowrap rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-brand-mono text-[12.5px] text-strong">
      {children}
    </code>
  );
}

/** A button the reader actually presses — tinted so actions stand out. */
function Cta({ children }: { children: React.ReactNode }) {
  return (
    <code className="mx-px whitespace-nowrap rounded-md border border-brand-100 bg-brand-50 px-1.5 py-0.5 font-brand-mono text-[12.5px] font-medium text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/15 dark:text-brand-200">
      {children}
    </code>
  );
}

/** A route/path shown in running text. */
function P({ children }: { children: React.ReactNode }) {
  return <span className="font-brand-mono text-[12.5px] text-muted">{children}</span>;
}

type Note = { tone: 'info' | 'reward'; body: React.ReactNode };
type Step = { title: string; body: React.ReactNode; note?: Note };
type Group = { phase?: string; steps: Step[] };
type RoleGuide = {
  key: string;
  eyebrow: string;
  title: string;
  who: string;
  meta: { icon: typeof Store; label: React.ReactNode }[];
  groups: Group[];
};

/* ── The content: owner, staff, customer (no platform admin) ───────────── */

const guides: RoleGuide[] = [
  {
    key: 'owner',
    eyebrow: 'For the business owner',
    title: 'Run your loyalty program',
    who: 'You design the stamp card, print the QR, add your counter staff, and watch the whole program from one dashboard. Everything a customer sees — logo, colours, rewards — is yours to set.',
    meta: [
      { icon: Store, label: <>Sign in at <P>/merchant/login</P></> },
      { icon: UserRound, label: <>Email + password</> },
    ],
    groups: [
      {
        phase: 'Set up',
        steps: [
          {
            title: 'Create your account',
            body: (
              <>
                On the login page, switch to the <Chip>Create account</Chip> tab. Enter your name,
                email and a password (at least 8 characters), then press <Cta>Create account</Cta> —
                you&rsquo;re signed in immediately, no email verification needed.
              </>
            ),
          },
          {
            title: 'Tell us about your business',
            body: (
              <>
                First-run onboarding asks for your <Chip>Business name</Chip> (required) plus an
                optional address and phone. This is exactly what customers see when they scan your
                QR. Press <Cta>Continue</Cta>.
              </>
            ),
          },
          {
            title: 'Design your stamp card',
            body: (
              <>
                Set the <Chip>Campaign name</Chip>, <Chip>Stamps to reward</Chip> (2&ndash;50, the
                classic is 10) and the <Chip>Reward</Chip>. A live preview fills in as you type.
                Press <Cta>Launch campaign</Cta> and your program is live.
              </>
            ),
            note: {
              tone: 'info',
              body: (
                <>
                  One campaign runs at a time. You can edit the numbers, pause, or resume it any
                  time from the <Chip>Campaign</Chip> page.
                </>
              ),
            },
          },
        ],
      },
      {
        phase: 'Go live at the counter',
        steps: [
          {
            title: 'Get to know your dashboard',
            body: (
              <>
                Your home base greets you by name and refreshes every 15 seconds. Four stat cards
                &mdash; <Chip>Customers</Chip>, <Chip>Stamps today</Chip>, <Chip>Rewards earned</Chip>{' '}
                and <Chip>Rewards waiting</Chip> &mdash; sit above a live feed of every stamp across
                the counter. A <Chip>Finish setting up</Chip> checklist guides the first-run steps.
              </>
            ),
          },
          {
            title: 'Put your QR out',
            body: (
              <>
                Open <Chip>QR code</Chip>. Use <Cta>Download PNG</Cta> for a high-res image, or{' '}
                <Cta>Print standee</Cta> for a ready-made counter sign. You can also copy the plain
                join link to share online.
              </>
            ),
          },
          {
            title: 'Add your counter staff',
            body: (
              <>
                On the <Chip>Staff</Chip> page, press <Cta>Add staff</Cta> and set a name, email,
                initial password and role &mdash; <Chip>Staff</Chip> (stamp, redeem, enrol) or{' '}
                <Chip>Manager</Chip> (staff powers + team stats + longer undo). Share the password;
                they sign in at <P>/staff</P> right away.
              </>
            ),
            note: {
              tone: 'info',
              body: (
                <>
                  Forgot a password? <Chip>Reset password</Chip> on any staff row sets a new one
                  instantly. Staff can also change their own from the console.
                </>
              ),
            },
          },
        ],
      },
      {
        phase: 'Run it day to day',
        steps: [
          {
            title: 'Manage regulars from Customers',
            body: (
              <>
                Search anyone by name, phone or code. Their page lets you <Cta>Add stamp</Cta>{' '}
                yourself, <Cta>Adjust</Cta> the balance with a logged reason, <Cta>Block</Cta> abuse,
                and add private <Chip>Notes &amp; tags</Chip> &mdash; alongside their full stamp
                history and consent record.
              </>
            ),
          },
          {
            title: 'Hand over — or track — rewards',
            body: (
              <>
                The <Chip>Rewards</Chip> page lists every earned voucher under <Chip>Waiting</Chip>,{' '}
                <Chip>Handed over</Chip> and <Chip>All</Chip>. Confirm one with{' '}
                <Cta>Mark handed over</Cta> &mdash; recorded permanently against a voucher code.
              </>
            ),
            note: {
              tone: 'reward',
              body: (
                <>
                  Usually your staff hand rewards over at the counter &mdash; this page is your paper
                  trail and a backup way to redeem.
                </>
              ),
            },
          },
          {
            title: 'Watch performance & keep the record',
            body: (
              <>
                <Chip>Analytics</Chip> shows stamps, new customers, repeat-rate and your most loyal
                regulars over 7 / 30 / 90 days. <Chip>Transactions</Chip> is the append-only
                &ldquo;record of truth&rdquo; for every stamp and correction, with an{' '}
                <Cta>Export CSV</Cta> button.
              </>
            ),
          },
          {
            title: 'Make it yours in Settings',
            body: (
              <>
                Upload a <Chip>Logo</Chip>, pick a <Chip>Brand colour</Chip> (previewed live on the
                card), set your <Chip>Timezone</Chip> and consent wording, and toggle daily / weekly
                notification emails.
              </>
            ),
          },
        ],
      },
    ],
  },
  {
    key: 'staff',
    eyebrow: 'For the counter',
    title: 'The counter console',
    who: 'You work the till. One screen does everything: find a customer, add a stamp, enrol someone new, and hand over rewards. Your manager or the owner sets up your login — there is no sign-up for you.',
    meta: [
      { icon: UserRound, label: <>Sign in at <P>/staff</P></> },
      { icon: Smartphone, label: <>Email + password · any phone</> },
    ],
    groups: [
      {
        steps: [
          {
            title: 'Sign in',
            body: (
              <>
                Go to <P>/staff</P> and enter the <Chip>Email</Chip> and <Chip>Password</Chip> your
                manager set for you. A &ldquo;Welcome!&rdquo; message drops you straight into the
                console, and it stays signed in.
              </>
            ),
          },
          {
            title: "Glance at today's numbers",
            body: (
              <>
                The strip at the top shows <Chip>You today: N stamps</Chip> and rewards handed over,
                refreshing every 45 seconds. Managers also see the whole counter&rsquo;s totals and a
                per-teammate breakdown.
              </>
            ),
          },
          {
            title: 'Find the customer',
            body: (
              <>
                Type into the big search box &mdash; <Chip>phone, code or name</Chip>. Or tap{' '}
                <Cta>Scan card QR</Cta> to read the QR straight off their card. No query yet? It
                shows everyone stamped recently.
              </>
            ),
          },
          {
            title: 'Add the stamp',
            body: (
              <>
                On their card, tap the big <Cta>Add stamp</Cta> button. The grid animates and updates
                live on the customer&rsquo;s own phone. That&rsquo;s the whole job, most of the time.
              </>
            ),
          },
          {
            title: 'Made a mistake? Undo it',
            body: (
              <>
                Right after stamping, an <Chip>Undo</Chip> button appears with a countdown. Regular
                staff get <b className="font-semibold text-strong">60 seconds</b> to undo their own
                last stamp; managers get <b className="font-semibold text-strong">15 minutes</b> and
                can undo any recent stamp.
              </>
            ),
          },
          {
            title: 'Enrol someone new — no OTP needed',
            body: (
              <>
                Tap <Cta>New customer</Cta>, type their <Chip>Phone number</Chip> (name optional),
                and enrol them on the spot. Leave <Chip>Add their first stamp right away</Chip>{' '}
                ticked to stamp as you go.
              </>
            ),
          },
          {
            title: 'Hand over a reward',
            body: (
              <>
                When a card completes, a <Chip>Reward unlocked!</Chip> banner offers{' '}
                <Cta>Hand over now</Cta> &mdash; and a fresh card starts automatically. Any waiting
                reward also shows a <Cta>Redeem</Cta> button.
              </>
            ),
            note: {
              tone: 'reward',
              body: (
                <>
                  The confirmation shows the customer&rsquo;s name, the reward and the voucher code
                  &mdash; double-check before you tap <Chip>Confirm hand-over</Chip>.
                </>
              ),
            },
          },
          {
            title: 'Change your own password',
            body: (
              <>
                Tap the key icon in the header, enter your current password, and set a new one. Use{' '}
                <Chip>Exit</Chip> to sign out on a shared device.
              </>
            ),
          },
        ],
      },
    ],
  },
  {
    key: 'customer',
    eyebrow: 'For the customer',
    title: 'Collect stamps, no app',
    who: 'You are the regular. Nothing to download and no password to remember — you join with your phone number, and your card lives in any browser. Show it at the counter; it fills up as you go.',
    meta: [
      { icon: QrCode, label: <>Start by scanning the shop&rsquo;s QR</> },
      { icon: Smartphone, label: <>Phone number + one-time code</> },
    ],
    groups: [
      {
        steps: [
          {
            title: 'Scan & join',
            body: (
              <>
                Scan the QR standee at the counter (or tap the shop&rsquo;s link). Enter your phone,
                tap <Cta>Send code</Cta>, then the 6-digit code you receive. First time? Add your
                name and tap <Cta>Join program</Cta>.
              </>
            ),
            note: {
              tone: 'info',
              body: (
                <>
                  Marketing messages are always a separate, unticked checkbox &mdash; joining never
                  signs you up for spam.
                </>
              ),
            },
          },
          {
            title: 'Get your card',
            body: (
              <>
                You&rsquo;re taken straight to your live loyalty card &mdash; the shop&rsquo;s
                colours, the stamp grid, how many stamps to go, and your personal{' '}
                <Chip>Customer ID</Chip>. It updates itself every few seconds while it&rsquo;s open.
              </>
            ),
          },
          {
            title: 'Show it at the counter',
            body: (
              <>
                On each visit, show the <Chip>QR panel</Chip> on your card &mdash; or just read out
                your code. Staff scan it and add your stamp; you&rsquo;ll see a
                &ldquo;New stamp added!&rdquo; pop up in real time.
              </>
            ),
          },
          {
            title: 'Claim your reward',
            body: (
              <>
                When the card fills, a bright <Chip>Reward ready to claim</Chip> card appears with a
                voucher code, and a fresh card quietly begins. Show the code at the counter to
                redeem &mdash; it vanishes once staff hand it over.
              </>
            ),
            note: {
              tone: 'reward',
              body: <>Every completed card mints a new voucher, so your rewards never expire mid-collection.</>,
            },
          },
          {
            title: 'Keep it in your wallet',
            body: (
              <>
                Tap <Cta>Add to Apple Wallet</Cta> or <Cta>Save to Google Wallet</Cta> to keep the
                card a swipe away on your phone &mdash; wherever the shop has wallet passes switched
                on.
              </>
            ),
          },
          {
            title: 'See every card in one place',
            body: (
              <>
                Visit <P>/my-cards</P>, verify your phone, and every business card you hold lines up
                together &mdash; each showing your progress or a &ldquo;reward ready to claim&rdquo;
                flag. Tap any to open it.
              </>
            ),
          },
        ],
      },
    ],
  },
];

/* ── The whole-idea loop, shown once at the top ────────────────────────── */

const loop = [
  { t: 'Scan & join', d: 'Customer scans the counter QR, verifies their phone' },
  { t: 'Collect a stamp', d: 'Staff add one stamp on each visit' },
  { t: 'Card fills up', d: 'Progress updates live on their phone' },
  { t: 'Reward unlocks', d: 'A voucher is minted, a fresh card starts' },
  { t: 'Hand it over', d: 'Staff confirm the reward at the counter' },
];

/* ── Rendering ─────────────────────────────────────────────────────────── */

function NoteBox({ note }: { note: Note }) {
  if (note.tone === 'reward') {
    return (
      <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
        <Gift className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{note.body}</p>
      </div>
    );
  }
  return (
    <div className="mt-3 flex gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-body">
      <Info className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <p>{note.body}</p>
    </div>
  );
}

function RoleSection({ role, index }: { role: RoleGuide; index: number }) {
  const icon = role.meta[0]?.icon ?? Store;
  const RoleIcon = { owner: ShoppingBag, staff: UserRound, customer: Smartphone }[role.key] ?? icon;

  // Continuous 1..N numbering across a role's phases.
  let n = 0;

  return (
    <section id={role.key} className="scroll-mt-20 border-t border-line/70">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <RoleIcon className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase">
              Role {String(index + 1).padStart(2, '0')} · {role.eyebrow}
            </p>
            <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-strong sm:text-[2.1rem]">
              {role.title}
            </h2>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed text-body">{role.who}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {role.meta.map((m, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-[13px] text-body"
            >
              <m.icon className="size-3.5 text-muted" aria-hidden />
              {m.label}
            </span>
          ))}
        </div>

        <div className="mt-10 space-y-8">
          {role.groups.map((group, gi) => (
            <div key={gi}>
              {group.phase && (
                <p className="mb-5 flex items-center gap-3 font-brand-mono text-[11px] font-semibold tracking-widest text-muted uppercase">
                  {group.phase}
                  <span className="h-px flex-1 bg-line" />
                </p>
              )}
              <ol className="space-y-0">
                {group.steps.map((step) => {
                  n += 1;
                  const num = n;
                  const isLastOverall =
                    gi === role.groups.length - 1 &&
                    step === group.steps[group.steps.length - 1];
                  return (
                    <li key={num} className="grid grid-cols-[34px_1fr] gap-4 pb-6 last:pb-0 sm:gap-5">
                      <div className="relative flex justify-center">
                        <span className="z-10 flex size-8 items-center justify-center rounded-full border-2 border-brand-500 bg-surface font-brand-mono text-[13px] font-semibold text-brand-600 dark:text-brand-300">
                          {num}
                        </span>
                        {!isLastOverall && (
                          <span className="absolute top-8 bottom-[-8px] left-1/2 w-px -translate-x-1/2 bg-line" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <h3 className="text-[16.5px] font-semibold text-strong">{step.title}</h3>
                        <p className="mt-1.5 text-[14.5px] leading-relaxed text-body">{step.body}</p>
                        {step.note && <NoteBox note={step.note} />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-dvh bg-surface text-strong">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-strong"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Stamp className="size-4" />
            </span>
            Stamposa
          </Link>
          <nav className="hidden items-center gap-6 text-[14px] text-body sm:flex">
            <a href="#owner" className="transition-colors hover:text-strong">Business owner</a>
            <a href="#staff" className="transition-colors hover:text-strong">Counter staff</a>
            <a href="#customer" className="transition-colors hover:text-strong">Customer</a>
            <Link href="/blog" className="transition-colors hover:text-strong">Blog</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggleCompact />
            <Link href={appHref("/merchant/login")}>
              <Button variant="brand" size="sm" className="whitespace-nowrap">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-5 pt-16 pb-4 sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 font-brand-mono text-[11px] tracking-widest text-brand-700 uppercase dark:bg-brand-500/15 dark:text-brand-200">
          <BookOpen className="size-3" aria-hidden /> Guide
        </span>
        <h1 className="mt-5 max-w-3xl font-display text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-strong sm:text-[3.25rem]">
          One loyalty program, three ways to use it
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-body">
          Stamposa turns the paper punch-card into a digital one: collect stamps, earn rewards, no
          app to install. Here&rsquo;s how it works for the owner, the counter, and the customer &mdash;
          step by step.
        </p>

        <div className="mt-8 flex flex-wrap gap-2.5">
          <a href="#owner">
            <Button variant="secondary" size="sm" className="rounded-lg">
              <ShoppingBag className="size-4" /> Business owner
            </Button>
          </a>
          <a href="#staff">
            <Button variant="secondary" size="sm" className="rounded-lg">
              <UserRound className="size-4" /> Counter staff
            </Button>
          </a>
          <a href="#customer">
            <Button variant="secondary" size="sm" className="rounded-lg">
              <Smartphone className="size-4" /> Customer
            </Button>
          </a>
        </div>
      </section>

      {/* ── The whole idea, in one line ─────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
        <div className="rounded-3xl bg-ink px-6 py-9 sm:px-10">
          <p className="font-brand-mono text-[11px] tracking-widest text-brand-300 uppercase">
            The whole idea, in one line
          </p>
          <ol className="mt-7 grid gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-5">
            {loop.map((s, i) => (
              <li key={s.t}>
                <span className="font-brand-mono text-[11px] tracking-widest text-brand-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mt-2 font-display text-[17px] font-medium text-white">{s.t}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/60">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Role sections ───────────────────────────────────────────────── */}
      {guides.map((role, i) => (
        <RoleSection key={role.key} role={role} index={i} />
      ))}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-display font-semibold text-strong">
              <span className="flex size-7 items-center justify-center rounded-md bg-brand-600 text-white">
                <Stamp className="size-3.5" />
              </span>
              Stamposa
            </p>
            <p className="mt-2 text-[13px] text-muted">Collect stamps. Earn rewards. No app needed.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-body">
            <Link href="/blog" className="transition-colors hover:text-strong">
              <Newspaper className="mr-1.5 inline size-3.5" aria-hidden />Blog
            </Link>
            <Link href={appHref("/merchant/login")} className="transition-colors hover:text-strong">
              <Store className="mr-1.5 inline size-3.5" aria-hidden />Merchant sign in
            </Link>
            <Link href={appHref("/staff/login")} className="transition-colors hover:text-strong">Staff login</Link>
            <Link href={appHref("/my-cards")} className="transition-colors hover:text-strong">My cards</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
