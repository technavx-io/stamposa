'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Check, PartyPopper } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { PageLoader } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';
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
});

type BusinessForm = z.infer<typeof businessSchema>;
type CampaignForm = z.infer<typeof campaignSchema>;

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
    <AuthShell wide>
      <ol className="mb-6 flex items-center gap-2 text-[13px]">
        {(['Business profile', 'Loyalty campaign'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const done = step > n;
          const active = step === n;
          return (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className="mx-1 h-px w-6 bg-zinc-200" />}
              <span
                className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-2 text-muted'
                }`}
              >
                {done ? <Check className="size-3" /> : n}
              </span>
              <span className={active ? 'font-medium text-strong' : 'text-muted'}>{label}</span>
            </li>
          );
        })}
      </ol>

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
    </AuthShell>
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
        <h1 className="text-xl font-semibold tracking-tight text-strong">
          Tell us about your business
        </h1>
        <p className="mt-1 text-sm text-muted">
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
      <Button type="submit" size="lg" variant="brand" className="w-full" loading={form.formState.isSubmitting}>
        Continue
      </Button>
    </form>
  );
}

function CampaignStep({ onDone }: { onDone: () => void }) {
  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { name: '', stampsRequired: 10, reward: '', description: '' },
  });
  const stamps = form.watch('stampsRequired');

  const submit = form.handleSubmit(async (values) => {
    try {
      await merchantApi.createCampaign({
        name: values.name,
        stampsRequired: values.stampsRequired,
        reward: values.reward,
        description: values.description || undefined,
      });
      toast.success('Your loyalty campaign is live!', { icon: <PartyPopper className="size-4" /> });
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
        <h1 className="text-xl font-semibold tracking-tight text-strong">
          Design your stamp card
        </h1>
        <p className="mt-1 text-sm text-muted">
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

      <div className="rounded-xl border border-dashed border-line bg-canvas/60 p-4">
        <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
          Card preview
        </p>
        <StampGrid total={Number.isFinite(stamps) && stamps >= 2 && stamps <= 50 ? stamps : 10} filled={3} size="sm" />
      </div>

      <Button type="submit" size="lg" variant="brand" className="w-full" loading={form.formState.isSubmitting}>
        Launch campaign
      </Button>
    </form>
  );
}
