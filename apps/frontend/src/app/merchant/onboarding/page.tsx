'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, Check, PartyPopper, Stamp, Sparkles } from 'lucide-react';
import { siteHref } from '@stamposa/ui/lib/hosts';
import { Button } from '@stamposa/ui/components/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { PageLoader } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';
import { AuroraBackdrop, GridPattern, auroraStyles } from '@/components/auth/aurora-visuals';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import { useStoredSession } from '@/lib/auth/use-stored-session';

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
  // No longer in the UI — backend hard-enforces one stamp per 24 h; we send
  // 1440 by default so the API contract stays satisfied.
  stampCooldownMinutes: z.coerce.number().int().min(1).max(1440).optional(),
});

type BusinessForm = z.infer<typeof businessSchema>;
type CampaignForm = z.infer<typeof campaignSchema>;

const STEPS = [
  { label: 'Business profile', icon: Building2 },
  { label: 'Loyalty campaign', icon: Sparkles },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { session, ready } = useStoredSession('MERCHANT');
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);

  const me = useQuery({
    queryKey: ['merchant', 'me'],
    queryFn: merchantApi.auth.me,
    enabled: !!session,
  });

  useEffect(() => {
    if (ready && !session) router.replace('/merchant/login');
  }, [session, ready, router]);

  useEffect(() => {
    if (me.data?.business) setStep(2);
  }, [me.data?.business]);

  if (!session || me.isPending) return <PageLoader label="Setting things up…" />;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#1a1a26] text-white">
      <style>{auroraStyles}</style>
      <AuroraBackdrop />
      <GridPattern />

      <header className="relative z-20 mx-auto flex h-16 w-full max-w-6xl items-center px-6 sm:px-10">
        <Link
          href={siteHref('/')}
          className="flex items-center gap-2 font-semibold tracking-tight text-white"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-lg shadow-brand-500/30">
            <Stamp className="size-4" />
          </span>
          Stamposa
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
        <section className="w-full max-w-2xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              Merchant portal
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
              Set up your loyalty program
            </h2>
            <p className="mt-1.5 text-sm text-white/60">
              Two quick steps and you&rsquo;re live at the counter.
            </p>

            <StepIndicator step={step} />

            <div className="mt-6">
              {step === 1 ? (
                <BusinessStep
                  onDone={async () => {
                    await queryClient.invalidateQueries({ queryKey: ['merchant', 'me'] });
                    setStep(2);
                  }}
                />
              ) : (
                <CampaignStep onDone={() => router.replace('/merchant/dashboard')} />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Two-step progress row — icon circles connected by a track, current step
 *  in amber, completed in indigo with a check, upcoming muted. */
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <ol className="mt-6 flex items-center gap-2">
      {STEPS.map((s, i) => {
        const n = (i + 1) as 1 | 2;
        const done = step > n;
        const active = step === n;
        const Icon = s.icon;
        return (
          <li key={s.label} className="flex flex-1 items-center gap-3">
            <span
              className={
                done
                  ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_18px_-4px_rgba(99,102,241,0.55)]'
                  : active
                    ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[#4a2f00] shadow-[0_6px_18px_-4px_rgba(251,191,36,0.55)]'
                    : 'flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/50'
              }
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
            </span>
            <div className="min-w-0">
              <p
                className={
                  active || done
                    ? 'text-[13px] font-semibold text-white'
                    : 'text-[13px] font-medium text-white/50'
                }
              >
                {s.label}
              </p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">
                Step {n}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={
                  done ? 'mx-1 h-px flex-1 bg-brand-500/60' : 'mx-1 h-px flex-1 bg-white/10'
                }
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-white">
          Tell us about your business
        </h1>
        <p className="mt-1 text-sm text-white/60">
          This is what customers see when they scan your QR code. You can add a logo later in
          Settings.
        </p>
      </div>
      <Field label="Business name" error={form.formState.errors.name?.message}>
        {(p) => <Input {...p} placeholder="Brew & Bean Coffee" {...form.register('name')} autoFocus />}
      </Field>
      <Field label="Address" optional error={form.formState.errors.address?.message}>
        {(p) => <Textarea {...p} rows={2} placeholder="12 MG Road, Indiranagar, Bengaluru" {...form.register('address')} />}
      </Field>
      <Field label="Business phone" optional error={form.formState.errors.phone?.message}>
        {(p) => <Input {...p} type="tel" placeholder="+91 80 4123 4567" {...form.register('phone')} />}
      </Field>
      <Button
        type="submit"
        size="lg"
        variant="brand"
        className="w-full"
        loading={form.formState.isSubmitting}
      >
        Continue
      </Button>
    </form>
  );
}

function CampaignStep({ onDone }: { onDone: () => void }) {
  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      stampsRequired: 10,
      reward: '',
      description: '',
      // Default 1440 min = 1 stamp per day (bug #10). Safest starting point;
      // merchants running faster programmes (coffee) can lower it.
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

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-white">
          Design your stamp card
        </h1>
        <p className="mt-1 text-sm text-white/60">
          The classic: buy 10, get 1 free. Change the numbers to fit your margins.
        </p>
      </div>
      <Field label="Campaign name" error={form.formState.errors.name?.message}>
        {(p) => <Input {...p} placeholder="Coffee Lovers Card" {...form.register('name')} autoFocus />}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Stamps to reward" error={form.formState.errors.stampsRequired?.message}>
          {(p) => (
            <Input {...p} type="number" min={2} max={50} {...form.register('stampsRequired')} />
          )}
        </Field>
        <Field label="Reward" error={form.formState.errors.reward?.message}>
          {(p) => <Input {...p} placeholder="1 free coffee" {...form.register('reward')} />}
        </Field>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-white/70">
        Stamposa enforces{' '}
        <span className="font-medium text-white">one stamp per customer per 24 hours</span> on
        every card.
      </div>
      <Field label="Description" optional error={form.formState.errors.description?.message}>
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            placeholder="Collect a stamp with every visit."
            {...form.register('description')}
          />
        )}
      </Field>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300">
          Card preview
        </p>
        <StampGrid
          total={Number.isFinite(stamps) && stamps >= 2 && stamps <= 50 ? stamps : 10}
          filled={3}
          size="sm"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        variant="brand"
        className="w-full"
        loading={form.formState.isSubmitting}
      >
        Launch campaign
      </Button>
    </form>
  );
}
