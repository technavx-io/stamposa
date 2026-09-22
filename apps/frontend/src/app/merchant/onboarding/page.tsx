'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  LayoutDashboard,
  PartyPopper,
  Printer,
  Sparkles,
  Stamp,
} from 'lucide-react';
import { siteHref } from '@stamposa/ui/lib/hosts';
import { Button } from '@stamposa/ui/components/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { PageLoader } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';
import { AuroraBackdrop, GridPattern, auroraStyles } from '@/components/auth/aurora-visuals';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import { useStoredSession } from '@/lib/auth/use-stored-session';

/* ────────────────────────────────────────────────────────────────────────
   Schemas — MATCH the existing backend contract exactly. Any change here
   is a functional refactor; this pass is purely visual + interaction.
   ──────────────────────────────────────────────────────────────────────── */

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Give your business a name').max(80),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
});

const campaignSchema = z.object({
  name: z.string().trim().min(2, 'Name your campaign').max(80),
  stampsRequired: z.coerce.number().int().min(2).max(50),
  reward: z.string().trim().min(2, 'Describe the reward').max(120),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  stampCooldownMinutes: z.coerce.number().int().min(1).max(1440).optional(),
});

type BusinessForm = z.infer<typeof businessSchema>;
type CampaignForm = z.infer<typeof campaignSchema>;

// The step scales from two to three: Business → Card → You're live.
const STEPS = [
  { key: 1, label: 'Business', icon: Building2 },
  { key: 2, label: 'Card', icon: Sparkles },
  { key: 3, label: "You're live", icon: PartyPopper },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/* ────────────────────────────────────────────────────────────────────────
   Page entry
   ──────────────────────────────────────────────────────────────────────── */

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const { session, ready } = useStoredSession('MERCHANT');
  const queryClient = useQueryClient();
  const [step, setStep] = useState<StepKey>(1);

  const me = useQuery({
    queryKey: ['merchant', 'me'],
    queryFn: merchantApi.auth.me,
    enabled: !!session,
  });

  useEffect(() => {
    if (ready && !session) router.replace('/merchant/login');
  }, [session, ready, router]);

  // Land on Step 2 if a business already exists but no campaign yet.
  useEffect(() => {
    if (me.data?.business) setStep((prev) => (prev === 1 ? 2 : prev));
  }, [me.data?.business]);

  if (!session || me.isPending) return <PageLoader label="Setting things up…" />;

  const firstName = (me.data?.actor.name ?? '').split(' ')[0]?.trim() || null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#1a1a26] text-white">
      <style>{auroraStyles}</style>
      <AuroraBackdrop />
      <GridPattern />

      <header className="relative z-20 mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link
          href={siteHref('/')}
          className="flex items-center gap-2 font-semibold tracking-tight text-white"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-lg shadow-brand-500/30">
            <Stamp className="size-4" />
          </span>
          Stamposa
        </Link>
        <p className="hidden text-xs font-medium text-white/50 sm:block">
          {step < 3 ? `Step ${step} of 2 · setup` : 'Setup complete'}
        </p>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-10 sm:py-8">
        <section className="w-full max-w-2xl">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl">
            <div className="p-6 pb-24 sm:p-8 sm:pb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                Merchant portal
              </p>
              {step === 1 && (
                <>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-[26px]">
                    {firstName ? `Welcome, ${firstName}.` : 'Welcome to Stamposa.'}
                  </h2>
                  <p className="mt-1.5 text-sm text-white/65">
                    Two quick steps and you&apos;re taking stamps at the counter.
                  </p>
                </>
              )}
              {step === 2 && (
                <>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-[26px]">
                    Design your card
                  </h2>
                  <p className="mt-1.5 text-sm text-white/65">
                    Buy 10, get 1 free — the classic. Change the numbers to fit your margins.
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-[26px]">
                    You&apos;re live.
                  </h2>
                  <p className="mt-1.5 text-sm text-white/65">
                    Your join QR is ready. Print it, tape it up, start stamping.
                  </p>
                </>
              )}

              <StepIndicator step={step} />

              <div className="mt-6">
                <StepTransition step={step}>
                  {step === 1 && (
                    <BusinessStep
                      onDone={async () => {
                        await queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
                        setStep(2);
                      }}
                    />
                  )}
                  {step === 2 && (
                    <CampaignStep
                      businessName={me.data?.business?.name ?? ''}
                      onBack={() => setStep(1)}
                      onDone={() => setStep(3)}
                    />
                  )}
                  {step === 3 && (
                    <LiveStep
                      businessName={me.data?.business?.name ?? ''}
                      onDone={() => router.replace(next ?? '/merchant/dashboard')}
                      onPrint={() => router.push('/merchant/qr')}
                    />
                  )}
                </StepTransition>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-white/50">
            Your data is yours. Export any time, on any plan.
          </p>
        </section>
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Step indicator — three dots + connecting track, animated fill.
   ──────────────────────────────────────────────────────────────────────── */

function StepIndicator({ step }: { step: StepKey }) {
  return (
    <ol className="mt-6 flex items-center gap-1.5" aria-label="Onboarding progress">
      {STEPS.map((s) => {
        const done = step > s.key;
        const active = step === s.key;
        const Icon = s.icon;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={
                done
                  ? 'flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_18px_-4px_rgba(99,102,241,0.55)]'
                  : active
                    ? 'flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[#4a2f00] shadow-[0_6px_18px_-4px_rgba(251,191,36,0.55)]'
                    : 'flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/50'
              }
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-3.5" />}
            </span>
            <p
              className={
                active
                  ? 'hidden text-[12px] font-semibold text-white sm:block'
                  : done
                    ? 'hidden text-[12px] font-medium text-white/85 sm:block'
                    : 'hidden text-[12px] font-medium text-white/45 sm:block'
              }
            >
              {s.label}
            </p>
            {s.key < STEPS.length && (
              <span
                aria-hidden
                className={done ? 'h-px flex-1 bg-brand-500/70' : 'h-px flex-1 bg-white/10'}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Cross-fade + slight vertical translate between steps, respecting reduced motion. */
function StepTransition({ step, children }: { step: StepKey; children: React.ReactNode }) {
  return (
    <div key={step} className="animate-step-in">
      {children}
      <style>{stepTransitionStyles}</style>
    </div>
  );
}

const stepTransitionStyles = `
  @keyframes step-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-step-in { animation: step-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
  @media (prefers-reduced-motion: reduce) {
    .animate-step-in { animation: none; }
  }
`;

/* ────────────────────────────────────────────────────────────────────────
   Step 1 — Business profile
   ──────────────────────────────────────────────────────────────────────── */

function BusinessStep({ onDone }: { onDone: () => Promise<void> }) {
  const form = useForm<BusinessForm>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: '', address: '', phone: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await merchantApi.createBusiness({
        name: values.name,
        address: values.address || undefined,
        phone: values.phone || undefined,
      });
      toast.success('Business profile created');
      await onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'BUSINESS_EXISTS') {
        await onDone();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : 'Could not create the business.');
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-4">
        <Field label="Business name" error={form.formState.errors.name?.message}>
          {(p) => (
            <>
              <Input
                {...p}
                placeholder="Brew & Bean Coffee"
                {...form.register('name')}
                autoFocus
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-amber-300/30"
              />
              <p className="mt-1.5 text-[12px] text-white/50">
                This is the name your customers see when they scan your QR. Change it any time in
                Settings.
              </p>
            </>
          )}
        </Field>

        <Field label="Address" optional error={form.formState.errors.address?.message}>
          {(p) => (
            <>
              <Textarea
                {...p}
                rows={2}
                placeholder="12 MG Road, Indiranagar, Bengaluru"
                {...form.register('address')}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-amber-300/30"
              />
              <p className="mt-1.5 text-[12px] text-white/50">
                Shown on your public page and used for the “Open in Maps” link.
              </p>
            </>
          )}
        </Field>

        <Field label="Business phone" optional error={form.formState.errors.phone?.message}>
          {(p) => (
            <>
              <Input
                {...p}
                type="tel"
                placeholder="+91 80 4123 4567"
                {...form.register('phone')}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-amber-300/30"
              />
              <p className="mt-1.5 text-[12px] text-white/50">
                Handy on receipts. We never share it.
              </p>
            </>
          )}
        </Field>
      </div>

      <StickyAction>
        <Button
          type="submit"
          size="lg"
          variant="brand"
          className="w-full"
          loading={form.formState.isSubmitting}
        >
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </StickyAction>
    </form>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Step 2 — Loyalty campaign
   ──────────────────────────────────────────────────────────────────────── */

function CampaignStep({
  businessName,
  onBack,
  onDone,
}: {
  businessName: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      stampsRequired: 10,
      reward: '',
      description: '',
      stampCooldownMinutes: 1440,
    },
  });
  const stamps = form.watch('stampsRequired');

  const submit = form.handleSubmit(async (values) => {
    try {
      await merchantApi.createCampaign({
        name: values.name,
        stampsRequired: values.stampsRequired,
        reward: values.reward,
        description: values.description || undefined,
        stampCooldownMinutes: 1440,
      });
      toast.success('Your loyalty campaign is live!', {
        icon: <PartyPopper className="size-4" />,
      });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CAMPAIGN_LIMIT') {
        onDone();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : 'Could not create the campaign.');
    }
  });

  const totalStamps =
    Number.isFinite(stamps) && stamps >= 2 && stamps <= 50 ? Number(stamps) : 10;

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Card preview promoted from a footer garnish to a proper hero — first
          thing the merchant sees when they arrive at Step 2. */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1e1b45]/70 via-[#161431]/60 to-[#0f0e26]/70 p-4">
        <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-amber-300">
          Live card preview
        </p>
        <StampGrid total={totalStamps} filled={3} size="md" tone="dark" />
        <p className="mt-3 text-[12px] text-white/60">
          {businessName || 'Your business'} · 3 of {totalStamps} stamps · reward at {totalStamps}
        </p>
      </div>

      <Field label="Campaign name" error={form.formState.errors.name?.message}>
        {(p) => (
          <>
            <Input
              {...p}
              placeholder="Coffee Lovers Card"
              {...form.register('name')}
              autoFocus
              className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-amber-300/30"
            />
            <p className="mt-1.5 text-[12px] text-white/50">
              What customers see at the top of their card. Keep it short and specific.
            </p>
          </>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Stamps to reward"
          error={form.formState.errors.stampsRequired?.message}
        >
          {(p) => (
            <>
              <Input
                {...p}
                type="number"
                min={2}
                max={50}
                {...form.register('stampsRequired')}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-amber-300/30"
              />
              <p className="mt-1.5 text-[12px] text-white/50">Your margin lever — 8-12 is typical.</p>
            </>
          )}
        </Field>
        <Field label="Reward" error={form.formState.errors.reward?.message}>
          {(p) => (
            <>
              <Input
                {...p}
                placeholder="1 free coffee"
                {...form.register('reward')}
                className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-amber-300/30"
              />
              <p className="mt-1.5 text-[12px] text-white/50">Kept tangible reads better.</p>
            </>
          )}
        </Field>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-white/70">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <span>
          Stamposa enforces{' '}
          <span className="font-medium text-white">one stamp per customer per 24 hours</span> — so
          nobody can game the card.
        </span>
      </div>

      <Field label="Description" optional error={form.formState.errors.description?.message}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            placeholder="Collect a stamp with every visit."
            {...form.register('description')}
            className="border-white/10 bg-white/[0.06] text-white placeholder:text-white/40 focus:border-amber-300 focus:outline-amber-300/30"
          />
        )}
      </Field>

      <StickyAction>
        <div className="flex w-full items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onBack}
            className="text-white/70 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button
            type="submit"
            size="lg"
            variant="brand"
            className="flex-1"
            loading={form.formState.isSubmitting}
          >
            Launch campaign
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </StickyAction>
    </form>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Step 3 — You're live (celebratory success with real join QR).
   ──────────────────────────────────────────────────────────────────────── */

function LiveStep({
  businessName,
  onDone,
  onPrint,
}: {
  businessName: string;
  onDone: () => void;
  onPrint: () => void;
}) {
  const qr = useQuery({
    queryKey: ['merchant', 'qr'],
    queryFn: () => merchantApi.getQr(512),
    staleTime: Infinity,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-amber-400 text-[#4a2f00] shadow-[0_10px_30px_-8px_rgba(251,191,36,0.55)] animate-reward-pulse">
          <PartyPopper className="size-6" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-white/70">
            {businessName || 'Your loyalty program'} is set up.
          </p>
          <p className="mt-1 text-sm text-white/60">
            Anyone who scans this QR joins your program in one tap — no app installs, nothing to
            lose.
          </p>
        </div>
      </div>

      {/* Big, generous QR. Kept on white so any camera reads it fast. */}
      <div className="mx-auto flex w-full max-w-[300px] flex-col items-center rounded-2xl border border-white/10 bg-white p-4 shadow-[0_25px_60px_-20px_rgba(15,12,30,0.9)]">
        {qr.isPending ? (
          <div className="flex aspect-square w-full items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : qr.data ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from our API
          <img
            src={qr.data.qrDataUrl}
            alt={`QR code linking to ${qr.data.joinUrl}`}
            className="aspect-square w-full"
          />
        ) : (
          <p className="p-8 text-center text-[13px] text-zinc-500">
            Couldn&apos;t load your QR just now — you can grab it from the QR tab.
          </p>
        )}
        <p className="mt-3 text-center text-[12px] font-medium text-zinc-800">
          Scan to join {businessName || 'us'}
        </p>
        {qr.data?.joinUrl && (
          <p className="mt-1 max-w-full truncate font-mono text-[10.5px] text-zinc-500">
            {qr.data.joinUrl.replace(/^https?:\/\//, '')}
          </p>
        )}
      </div>

      <StickyAction>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            size="lg"
            variant="brand"
            className="flex-1"
            onClick={onDone}
          >
            <LayoutDashboard className="size-4" /> Open dashboard
          </Button>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="flex-1 border-white/10 bg-white/[0.06] text-white hover:bg-white/10"
            onClick={onPrint}
          >
            <Printer className="size-4" /> Print my join card
          </Button>
        </div>
      </StickyAction>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   StickyAction — pins the CTA to the bottom of the glass card on mobile
   so the button is always in thumb reach, and honours the safe-area inset
   so it doesn't sit under the iOS home indicator. On sm+ it inlines.
   ──────────────────────────────────────────────────────────────────────── */

function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mobile: pinned to the bottom of the glass card so the CTA is always
          in thumb reach. Uses a scoped safe-area rule so nothing shows on
          desktop where the CTA can inline. */}
      <div className="sticky-action absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#1a1a26]/70 px-6 py-4 backdrop-blur-xl sm:relative sm:inset-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pt-2 sm:backdrop-blur-none">
        {children}
      </div>
      <style>{stickyActionStyles}</style>
    </>
  );
}

const stickyActionStyles = `
  @media (max-width: 639px) {
    .sticky-action {
      padding-bottom: max(1rem, env(safe-area-inset-bottom));
    }
  }
`;
