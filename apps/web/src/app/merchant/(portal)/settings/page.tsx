'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangle, Download, ImagePlus, Pause, Play, Trash2 } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import { useMerchant } from '@/lib/auth/merchant-context';
import { downloadAuthenticated } from '@/lib/download';
import {cn} from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { StampGrid } from '@/components/stamp-grid';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { Modal } from '@/components/ui/modal';
import { Panel, PanelHeader } from '@/components/ui/surface';

const schema = z.object({
  name: z.string().trim().min(2, 'Business name is required').max(80),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  category: z.string().trim().max(40).optional().or(z.literal('')),
  timezone: z.string().trim().max(64),
});
type FormValues = z.infer<typeof schema>;

/** Common Indian-market zones first, then a few international ones. */
const timezones = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

const categories = [
  'cafe',
  'restaurant',
  'bakery',
  'salon',
  'spa',
  'gym',
  'retail',
  'pharmacy',
  'other',
];

const swatches = ['#4F46E5', '#0D9488', '#B45309', '#BE123C', '#7C3AED', '#0369A1', '#15803D', '#1F2937'];

export default function SettingsPage() {
  const { me, business, refresh } = useMerchant();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [brandColor, setBrandColor] = useState(business.brandColor ?? '#4F46E5');
  const [consentText, setConsentText] = useState<string | null>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const campaigns = useQuery({ queryKey: ['merchant', 'campaigns'], queryFn: merchantApi.listCampaigns });
  const liveCampaign = campaigns.data?.find((c) => c.status !== 'ARCHIVED') ?? null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: business.name,
      address: business.address ?? '',
      phone: business.phone ?? '',
      category: business.category ?? '',
      timezone: business.timezone,
    },
  });

  const save = form.handleSubmit(async (values) => {
    try {
      await merchantApi.updateBusiness({
        name: values.name,
        address: values.address || undefined,
        phone: values.phone || undefined,
        category: values.category || undefined,
        timezone: values.timezone,
      });
      toast.success('Business profile saved');
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the profile.');
    }
  });

  const saveField = useMutation({
    mutationFn: (data: Parameters<typeof merchantApi.updateBusiness>[0]) =>
      merchantApi.updateBusiness(data),
    onSuccess: async () => {
      toast.success('Saved');
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save.'),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => merchantApi.uploadLogo(file),
    onSuccess: async () => {
      toast.success('Logo updated');
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Upload failed.'),
  });

  const removeLogo = useMutation({
    mutationFn: () => merchantApi.removeLogo(),
    onSuccess: async () => {
      toast.success('Logo removed');
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not remove the logo.'),
  });

  const togglePause = useMutation({
    mutationFn: () =>
      merchantApi.updateCampaign(liveCampaign!.id, {
        status: liveCampaign!.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      }),
    onSuccess: async (c) => {
      toast.success(c.status === 'ACTIVE' ? 'Programme resumed' : 'Programme paused');
      setPauseOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update.'),
  });

  const download = async (key: 'customers' | 'transactions' | 'rewards') => {
    setDownloading(key);
    try {
      await downloadAuthenticated(merchantApi.exportPaths[key], `${key}.csv`);
      toast.success('Download started');
    } catch {
      toast.error('Could not download the export.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Your business profile, as customers see it." />

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Panel>
            <PanelHeader title="Business profile" />
            <form onSubmit={save} className="space-y-4 p-5">
              <Field label="Business name" error={form.formState.errors.name?.message}>
                {(p) => <Input {...p} {...form.register('name')} />}
              </Field>
              <Field label="Address" optional error={form.formState.errors.address?.message}>
                {(p) => <Textarea {...p} rows={2} {...form.register('address')} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business phone" optional error={form.formState.errors.phone?.message}>
                  {(p) => <Input {...p} type="tel" {...form.register('phone')} />}
                </Field>
                <Field label="Category" optional>
                  {(p) => (
                    <select
                      {...p}
                      {...form.register('category')}
                      className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
                    >
                      <option value="">Not set</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              <Field
                label="Timezone"
                hint="Decides what counts as “today” in your dashboard and reports."
              >
                {(p) => (
                  <select
                    {...p}
                    {...form.register('timezone')}
                    className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Save changes
              </Button>
            </form>
          </Panel>

          <Panel>
            <PanelHeader
              title="Consent wording"
              description="What customers agree to when they join. Editing it starts a new version; past agreements keep the text they saw."
            />
            <div className="space-y-3 p-5">
              <Textarea
                rows={3}
                value={consentText ?? business.consentText ?? ''}
                onChange={(e) => setConsentText(e.target.value)}
                placeholder={`I agree to ${business.name} contacting me with offers and updates. I can unsubscribe at any time.`}
              />
              <Button
                size="sm"
                loading={saveField.isPending}
                disabled={consentText === null || consentText === (business.consentText ?? '')}
                onClick={() => saveField.mutate({ consentText: consentText ?? '' })}
              >
                Save wording
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Notifications" description="What we send you about your programme." />
            <ul className="divide-y divide-line-soft">
              {(
                [
                  ['notifyDailySummary', 'Daily summary', 'A short recap of yesterday each morning'],
                  ['notifyWeeklyDigest', 'Weekly digest', 'How the week went, every Monday'],
                  [
                    'notifyStaffInactive',
                    'Staff inactivity alerts',
                    'Tell me if nobody has stamped in 48 hours',
                  ],
                ] as const
              ).map(([key, label, description]) => (
                <li key={key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-strong">{label}</p>
                    <p className="text-[13px] text-muted">{description}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={business[key]}
                    aria-label={label}
                    onClick={() => saveField.mutate({ [key]: !business[key] })}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      business[key] ? 'bg-brand-600' : 'bg-zinc-200',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 size-5 rounded-full bg-surface shadow transition-transform',
                        business[key] ? 'translate-x-5.5' : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="border-red-200">
            <PanelHeader title="Danger zone" description="Careful — these affect live customers." />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-strong">
                    {liveCampaign?.status === 'PAUSED' ? 'Programme is paused' : 'Pause the programme'}
                  </p>
                  <p className="text-[13px] text-muted">
                    Stops new joins and stamping. Existing cards stay valid.
                  </p>
                </div>
                <Button
                  variant={liveCampaign?.status === 'PAUSED' ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={!liveCampaign}
                  loading={togglePause.isPending}
                  onClick={() =>
                    liveCampaign?.status === 'PAUSED' ? togglePause.mutate() : setPauseOpen(true)
                  }
                >
                  {liveCampaign?.status === 'PAUSED' ? (
                    <>
                      <Play className="size-4" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="size-4" /> Pause
                    </>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
                <div>
                  <p className="text-sm font-medium text-strong">Export everything first</p>
                  <p className="text-[13px] text-muted">
                    Your customer list is yours — download it any time, on any plan.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['customers', 'transactions', 'rewards'] as const).map((key) => (
                    <Button
                      key={key}
                      variant="secondary"
                      size="sm"
                      loading={downloading === key}
                      onClick={() => void download(key)}
                    >
                      <Download className="size-4" /> {key}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Panel>
            <PanelHeader title="Logo" description="PNG, JPEG or WebP, up to 2 MB." />
            <div className="flex items-center gap-4 p-5">
              <LogoAvatar name={business.name} logoUrl={business.logoUrl} size="xl" />
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo.mutate(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  loading={uploadLogo.isPending}
                >
                  <ImagePlus className="size-4" /> {business.logoUrl ? 'Replace' : 'Upload logo'}
                </Button>
                {business.logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLogo.mutate()}
                    loading={removeLogo.isPending}
                  >
                    <Trash2 className="size-4" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Brand colour" description="Used on the customer card and join page." />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                {swatches.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => setBrandColor(hex)}
                    aria-label={`Choose ${hex}`}
                    className={cn(
                      'size-8 rounded-lg ring-offset-2 transition-all',
                      brandColor.toLowerCase() === hex.toLowerCase()
                        ? 'ring-2 ring-zinc-900'
                        : 'hover:scale-105',
                    )}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-line"
                  aria-label="Custom colour"
                />
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 font-mono text-[13px]"
                  maxLength={7}
                />
              </div>

              {/* Live preview so the choice is judged in context, not abstractly. */}
              <div
                className="rounded-2xl p-4 text-white"
                style={{
                  background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 60%, #18181b 100%)`,
                }}
              >
                <p className="text-sm font-semibold">{business.name}</p>
                <div className="my-3">
                  <StampGrid total={8} filled={3} size="sm" tone="dark" />
                </div>
                <p className="text-xs text-white/70">Card preview</p>
              </div>

              <Button
                size="sm"
                loading={saveField.isPending}
                disabled={brandColor.toLowerCase() === (business.brandColor ?? '').toLowerCase()}
                onClick={() => saveField.mutate({ brandColor })}
              >
                Save colour
              </Button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Account" />
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Owner</dt>
                <dd className="font-medium text-strong">{me.actor.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Login email</dt>
                <dd className="font-medium text-strong">{me.actor.email ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Join link</dt>
                <dd className="max-w-[60%] truncate font-mono text-xs text-body">
                  {business.joinUrl}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      <Modal
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Pause the programme?"
        description="New customers can't join and staff can't add stamps. Existing cards and rewards stay exactly as they are."
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Your QR code will show “not accepting new members” until you resume.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPauseOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={togglePause.isPending} onClick={() => togglePause.mutate()}>
              <Pause className="size-4" /> Pause programme
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
