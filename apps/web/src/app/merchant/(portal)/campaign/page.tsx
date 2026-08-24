'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pause, Play, Stamp } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import type { Campaign } from '@/lib/api/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Badge, EmptyState, Panel, PanelHeader, Spinner } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';
import { LoadError } from '@/components/ui/load-error';

const schema = z.object({
  name: z.string().trim().min(2, 'Name your campaign').max(80),
  stampsRequired: z.coerce.number().int().min(2, 'Minimum 2').max(50, 'Maximum 50'),
  reward: z.string().trim().min(2, 'Describe the reward').max(120),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  dailyStampCap: z.coerce.number().int().min(0).max(20).optional(),
  terms: z.string().trim().max(400).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export default function CampaignPage() {
  const campaigns = useQuery({ queryKey: ['merchant', 'campaigns'], queryFn: merchantApi.listCampaigns });

  if (campaigns.isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (campaigns.isError) {
    return (
      <LoadError
        title="Couldn't load your campaign"
        error={campaigns.error}
        onRetry={() => void campaigns.refetch()}
      />
    );
  }

  const current = campaigns.data?.find((c) => c.status !== 'ARCHIVED') ?? null;

  return (
    <>
      <PageHeader
        title="Loyalty campaign"
        description="The stamp card your customers collect on. One campaign runs at a time."
      />
      {current ? <EditCampaign campaign={current} /> : <CreateCampaign />}
    </>
  );
}

function CreateCampaign() {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      stampsRequired: 10,
      reward: '',
      description: '',
      dailyStampCap: 1,
      terms: '',
    },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await merchantApi.createCampaign({
        name: values.name,
        stampsRequired: values.stampsRequired,
        reward: values.reward,
        description: values.description || undefined,
        dailyStampCap: values.dailyStampCap || undefined,
        terms: values.terms || undefined,
      });
      toast.success('Campaign launched!');
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not create the campaign.');
    }
  });

  return (
    <Panel className="max-w-xl">
      <PanelHeader title="Create your campaign" description="A classic stamp card. You can pause or edit it any time." />
      <form onSubmit={submit} className="space-y-4 p-5">
        <CampaignFields form={form} />
        <Button type="submit" variant="brand" loading={form.formState.isSubmitting}>
          <Stamp className="size-4" /> Launch campaign
        </Button>
      </form>
    </Panel>
  );
}

function EditCampaign({ campaign }: { campaign: Campaign }) {
  const queryClient = useQueryClient();
  const [confirmStamps, setConfirmStamps] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: campaign.name,
      stampsRequired: campaign.stampsRequired,
      reward: campaign.reward,
      description: campaign.description ?? '',
      dailyStampCap: campaign.dailyStampCap ?? 0,
      terms: campaign.terms ?? '',
    },
  });
  const stamps = form.watch('stampsRequired');
  const stampsChanged = Number(stamps) !== campaign.stampsRequired;

  const save = form.handleSubmit(async (values) => {
    if (stampsChanged && !confirmStamps) {
      setConfirmStamps(true);
      return;
    }
    try {
      await merchantApi.updateCampaign(campaign.id, {
        name: values.name,
        stampsRequired: values.stampsRequired,
        reward: values.reward,
        description: values.description || undefined,
        dailyStampCap: values.dailyStampCap ? values.dailyStampCap : null,
        terms: values.terms || undefined,
      });
      toast.success('Campaign updated');
      setConfirmStamps(false);
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not update the campaign.');
    }
  });

  const toggleStatus = useMutation({
    mutationFn: () =>
      merchantApi.updateCampaign(campaign.id, {
        status: campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      }),
    onSuccess: async (updated) => {
      toast.success(updated.status === 'ACTIVE' ? 'Campaign resumed' : 'Campaign paused');
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update status.'),
  });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <Panel className="lg:col-span-3">
        <PanelHeader
          title="Campaign settings"
          action={
            <div className="flex items-center gap-2">
              <Badge tone={campaign.status === 'ACTIVE' ? 'green' : 'amber'}>
                {campaign.status === 'ACTIVE' ? 'Live' : 'Paused'}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toggleStatus.mutate()}
                loading={toggleStatus.isPending}
              >
                {campaign.status === 'ACTIVE' ? (
                  <>
                    <Pause className="size-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" /> Resume
                  </>
                )}
              </Button>
            </div>
          }
        />
        <form onSubmit={save} className="space-y-4 p-5">
          <CampaignFields form={form} />
          {stampsChanged && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              Changing the stamp target affects everyone&apos;s progress toward the reward.
              {confirmStamps ? ' Click save again to confirm.' : ''}
            </p>
          )}
          <Button type="submit" loading={form.formState.isSubmitting}>
            Save changes
          </Button>
        </form>
      </Panel>

      <Panel className="lg:col-span-2">
        <PanelHeader title="Customer view" description={`${campaign.memberCount} enrolled`} />
        <div className="space-y-4 p-5">
          <div className="rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-brand-950 p-5 text-white">
            <p className="font-semibold">{form.watch('name') || campaign.name}</p>
            <p className="mt-0.5 text-xs text-white/60">
              {form.watch('description') || campaign.description || 'Collect stamps with every visit.'}
            </p>
            <div className="my-4">
              <StampGrid
                total={Number.isFinite(Number(stamps)) && Number(stamps) >= 2 && Number(stamps) <= 50 ? Number(stamps) : campaign.stampsRequired}
                filled={3}
                size="sm"
                tone="dark"
              />
            </div>
            <p className="text-sm font-medium">{form.watch('reward') || campaign.reward}</p>
          </div>
          {campaign.status !== 'ACTIVE' && (
            <EmptyState
              title="Campaign paused"
              description="Customers can't join and staff can't stamp until you resume it."
            />
          )}
        </div>
      </Panel>
    </div>
  );
}

function CampaignFields({ form }: { form: ReturnType<typeof useForm<FormValues>> }) {
  return (
    <>
      <Field label="Campaign name" error={form.formState.errors.name?.message}>
        {(p) => <Input {...p} {...form.register('name')} />}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Stamps to reward" error={form.formState.errors.stampsRequired?.message}>
          {(p) => <Input {...p} type="number" min={2} max={50} {...form.register('stampsRequired')} />}
        </Field>
        <Field label="Reward" error={form.formState.errors.reward?.message}>
          {(p) => <Input {...p} {...form.register('reward')} />}
        </Field>
      </div>
      <Field label="Description" optional error={form.formState.errors.description?.message}>
        {(p) => <Textarea {...p} rows={2} {...form.register('description')} />}
      </Field>
      <Field
        label="Daily stamp limit"
        hint="Stops one customer collecting many stamps in a single visit. 0 = no limit."
        error={form.formState.errors.dailyStampCap?.message}
      >
        {(p) => <Input {...p} type="number" min={0} max={20} {...form.register('dailyStampCap')} />}
      </Field>
      <Field label="Terms" optional hint="Small print shown on the card and join page.">
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            placeholder="One stamp per visit. Rewards cannot be exchanged for cash."
            {...form.register('terms')}
          />
        )}
      </Field>
    </>
  );
}
