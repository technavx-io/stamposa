'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  Download,
  ExternalLink,
  FilePlus,
  FileText,
  ImagePlus,
  Menu,
  Pause,
  Play,
  RefreshCw,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { merchantApi, type HandoffCreated } from '@/lib/api/endpoints';
import { useMerchant } from '@/lib/auth/merchant-context';
import { downloadAuthenticated } from '@/lib/download';
import {cn} from '@stamposa/ui/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { StampGrid } from '@/components/stamp-grid';
import { Button } from '@stamposa/ui/components/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { Panel, PanelHeader } from '@/components/ui/surface';
import { CardImageField, EmojiChoice, REWARD_EMOJIS, STAMP_EMOJIS } from '@/components/merchant/card-style-fields';
import { cardBackground } from '@/lib/card-bg';
import { Star } from 'lucide-react';

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
  const [stampIcon, setStampIcon] = useState(business.stampIcon ?? '');
  const [rewardIcon, setRewardIcon] = useState(business.rewardIcon ?? '');
  const [imageTint, setImageTint] = useState(business.cardImageTint);
  const [consentText, setConsentText] = useState<string | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
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

  const uploadCardImage = useMutation({
    mutationFn: (file: File) => merchantApi.uploadCardImage(file),
    onSuccess: async () => {
      toast.success('Card image updated');
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Upload failed.'),
  });

  const removeCardImage = useMutation({
    mutationFn: () => merchantApi.removeCardImage(),
    onSuccess: async () => {
      toast.success('Card image removed');
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not remove the image.'),
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
            <PanelHeader
              title="Google reviews"
              description="Add your review link and every customer card gets a “Leave a Google review” button."
            />
            <div className="space-y-3 p-5">
              <Field
                label="Google review link"
                optional
                hint="In Google Business Profile, choose “Ask for reviews” and copy the link. A Google Maps share link or your Place ID works too."
              >
                {(p) => (
                  <Input
                    {...p}
                    type="url"
                    inputMode="url"
                    placeholder="https://g.page/r/…/review"
                    value={reviewLink ?? business.googleReviewUrl ?? ''}
                    onChange={(e) => setReviewLink(e.target.value)}
                  />
                )}
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  loading={saveField.isPending}
                  disabled={reviewLink === null || reviewLink.trim() === (business.googleReviewUrl ?? '')}
                  onClick={() =>
                    saveField
                      .mutateAsync({ googleReviewUrl: reviewLink?.trim() ?? '' })
                      .then(() => setReviewLink(null))
                      .catch(() => undefined)
                  }
                >
                  Save link
                </Button>
                {business.googleReviewUrl && (
                  <a
                    href={business.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                  >
                    <Star className="size-4" /> Open review page
                  </a>
                )}
              </div>
            </div>
          </Panel>

          <BusinessInfoPanel />

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
                  <Switch
                    checked={business[key]}
                    onCheckedChange={(next) => saveField.mutate({ [key]: next })}
                    aria-label={label}
                  />
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
            <PanelHeader title="Card look" description="Defaults for the customer card and join page. Campaigns can override these." />
            <div className="space-y-4 p-5">
              <p className="text-[13px] font-medium text-body">Brand colour</p>
              <div className="flex flex-wrap gap-2">
                {swatches.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => setBrandColor(hex)}
                    aria-label={`Choose ${hex}`}
                    className={cn(
                      'size-8 cursor-pointer rounded-lg ring-offset-2 transition-all',
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
                className="rounded-2xl bg-cover bg-center p-4 text-white"
                style={{
                  background: cardBackground({
                    color: brandColor,
                    cardImageUrl: business.cardImageUrl,
                    imageTinted: imageTint,
                  }),
                }}
              >
                <p className="text-sm font-semibold">{business.name}</p>
                <div className="my-3">
                  <StampGrid
                    total={8}
                    filled={3}
                    size="sm"
                    tone="dark"
                    stampIcon={stampIcon || null}
                    rewardIcon={rewardIcon || null}
                  />
                </div>
                <p className="text-xs text-white/70">Card preview</p>
              </div>

              <div className="space-y-2 border-t border-line-soft pt-4">
                <p className="text-[13px] font-medium text-body">Stamp icon</p>
                <EmojiChoice
                  value={stampIcon}
                  onChange={setStampIcon}
                  presets={STAMP_EMOJIS}
                  defaultHint="Using the default check mark."
                />
              </div>
              <div className="space-y-2">
                <p className="text-[13px] font-medium text-body">Reward icon</p>
                <EmojiChoice
                  value={rewardIcon}
                  onChange={setRewardIcon}
                  presets={REWARD_EMOJIS}
                  defaultHint="Using the default gift."
                />
              </div>

              <div className="space-y-2 border-t border-line-soft pt-4">
                <p className="text-[13px] font-medium text-body">Card background image</p>
                <CardImageField
                  imageUrl={business.cardImageUrl}
                  onFile={(f) => uploadCardImage.mutate(f)}
                  onRemove={() => removeCardImage.mutate()}
                  uploading={uploadCardImage.isPending}
                  removing={removeCardImage.isPending}
                />
                {business.cardImageUrl && (
                  <label className="flex items-center gap-2 text-[13px] text-body">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={imageTint}
                      onChange={(e) => setImageTint(e.target.checked)}
                    />
                    Tint the image with the brand colour
                  </label>
                )}
                <p className="text-[12px] text-muted">
                  PNG, JPEG or WebP, up to 4 MB. Untick the tint to show the image on its own (a soft
                  dark scrim keeps text readable).
                </p>
              </div>

              <Button
                size="sm"
                loading={saveField.isPending}
                disabled={
                  brandColor.toLowerCase() === (business.brandColor ?? '').toLowerCase() &&
                  stampIcon === (business.stampIcon ?? '') &&
                  rewardIcon === (business.rewardIcon ?? '') &&
                  imageTint === business.cardImageTint
                }
                onClick={() =>
                  saveField.mutate({
                    brandColor,
                    stampIcon: stampIcon || null,
                    rewardIcon: rewardIcon || null,
                    cardImageTint: imageTint,
                  })
                }
              >
                Save card look
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

// ── Menu & info page section ─────────────────────────────────────────────
// Fields for /b/<slug>. Kept in its own component so the settings page
// stays legible; it also owns its own state / mutation so a bad URL only
// fails this form, not the whole page.

const infoSchema = z.object({
  menuUrl: z.string().trim().max(500).optional().or(z.literal('')),
  aboutText: z.string().trim().max(500).optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  websiteUrl: z.string().trim().max(500).optional().or(z.literal('')),
  hoursText: z.string().trim().max(200).optional().or(z.literal('')),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .email('That does not look like an email address.')
    .optional()
    .or(z.literal('')),
  googleMapsUrl: z.string().trim().max(500).optional().or(z.literal('')),
  instagramUrl: z.string().trim().max(500).optional().or(z.literal('')),
  facebookUrl: z.string().trim().max(500).optional().or(z.literal('')),
  youtubeUrl: z.string().trim().max(500).optional().or(z.literal('')),
  xUrl: z.string().trim().max(500).optional().or(z.literal('')),
  linkedinUrl: z.string().trim().max(500).optional().or(z.literal('')),
  tiktokUrl: z.string().trim().max(500).optional().or(z.literal('')),
  whatsappUrl: z.string().trim().max(500).optional().or(z.literal('')),
});
type InfoFormValues = z.infer<typeof infoSchema>;

function BusinessInfoPanel() {
  const { business } = useMerchant();
  const queryClient = useQueryClient();

  const info = useQuery({
    queryKey: ['merchant', 'business-info'],
    queryFn: merchantApi.businessInfo,
  });

  const form = useForm<InfoFormValues>({
    resolver: zodResolver(infoSchema),
    values: {
      menuUrl: info.data?.menuUrl ?? '',
      aboutText: info.data?.aboutText ?? '',
      address: info.data?.address ?? '',
      phone: info.data?.phone ?? '',
      websiteUrl: info.data?.websiteUrl ?? '',
      hoursText: info.data?.hoursText ?? '',
      contactEmail: info.data?.contactEmail ?? '',
      googleMapsUrl: info.data?.googleMapsUrl ?? '',
      instagramUrl: info.data?.instagramUrl ?? '',
      facebookUrl: info.data?.facebookUrl ?? '',
      youtubeUrl: info.data?.youtubeUrl ?? '',
      xUrl: info.data?.xUrl ?? '',
      linkedinUrl: info.data?.linkedinUrl ?? '',
      tiktokUrl: info.data?.tiktokUrl ?? '',
      whatsappUrl: info.data?.whatsappUrl ?? '',
    },
    resetOptions: { keepDirtyValues: true },
  });

  const save = form.handleSubmit(async (values) => {
    try {
      // The API treats "" as clear-this-field; we forward as-is.
      await merchantApi.updateBusinessInfo({
        menuUrl: values.menuUrl ?? '',
        aboutText: values.aboutText ?? '',
        address: values.address ?? '',
        phone: values.phone ?? '',
        websiteUrl: values.websiteUrl ?? '',
        hoursText: values.hoursText ?? '',
        contactEmail: values.contactEmail ?? '',
        googleMapsUrl: values.googleMapsUrl ?? '',
        instagramUrl: values.instagramUrl ?? '',
        facebookUrl: values.facebookUrl ?? '',
        youtubeUrl: values.youtubeUrl ?? '',
        xUrl: values.xUrl ?? '',
        linkedinUrl: values.linkedinUrl ?? '',
        tiktokUrl: values.tiktokUrl ?? '',
        whatsappUrl: values.whatsappUrl ?? '',
      });
      toast.success('Menu & info page saved');
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'business-info'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the info page.');
    }
  });

  // The public /b/<slug> lives on the same host as the merchant portal
  // (a Next.js route); a relative link works everywhere the app is served.
  const publicHref = `/b/${business.slug}`;

  return (
    <Panel>
      <PanelHeader
        title="Menu & info page"
        description="A public page for your business — Instagram bio, receipts, anywhere. Shows what customers see when they land outside the loyalty flow."
      />
      <form onSubmit={save} className="space-y-4 p-5">
        <div className="rounded-lg border border-line-soft bg-surface-2/40 px-3 py-2 text-[13px] text-body">
          Your public page:{' '}
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
          >
            {publicHref} <ExternalLink className="size-3.5" />
          </a>
        </div>

        <MenuPdfUploader menuUrl={info.data?.menuUrl ?? null} />

        <Field
          label="View-menu link"
          optional
          hint={
            isHostedMenuPdf(info.data?.menuUrl ?? null)
              ? 'Auto-set from your uploaded menu PDF. Remove the PDF above to enter an external URL instead.'
              : 'Point this at wherever your menu lives — Zomato, an Instagram post, a PDF on Drive, anywhere.'
          }
          error={form.formState.errors.menuUrl?.message}
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              placeholder="https://www.zomato.com/…"
              disabled={isHostedMenuPdf(info.data?.menuUrl ?? null)}
              {...form.register('menuUrl')}
            />
          )}
        </Field>

        <Field
          label="About the business"
          optional
          hint="One or two lines — what makes you you."
          error={form.formState.errors.aboutText?.message}
        >
          {(p) => <Textarea {...p} rows={3} {...form.register('aboutText')} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Address"
            optional
            error={form.formState.errors.address?.message}
          >
            {(p) => <Textarea {...p} rows={2} {...form.register('address')} />}
          </Field>
          <Field
            label="Hours"
            optional
            hint="Free form — e.g. Mon–Sat · 10am–10pm"
            error={form.formState.errors.hoursText?.message}
          >
            {(p) => <Textarea {...p} rows={2} {...form.register('hoursText')} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Phone (public)"
            optional
            error={form.formState.errors.phone?.message}
          >
            {(p) => <Input {...p} type="tel" {...form.register('phone')} />}
          </Field>
          <Field
            label="Contact email"
            optional
            error={form.formState.errors.contactEmail?.message}
          >
            {(p) => <Input {...p} type="email" {...form.register('contactEmail')} />}
          </Field>
        </div>

        <Field
          label="Website"
          optional
          error={form.formState.errors.websiteUrl?.message}
        >
          {(p) => <Input {...p} type="url" inputMode="url" {...form.register('websiteUrl')} />}
        </Field>

        <Field
          label="Google Maps link"
          optional
          hint="Optional — used by the “Open in Maps” button. If blank, the address is used."
          error={form.formState.errors.googleMapsUrl?.message}
        >
          {(p) => <Input {...p} type="url" inputMode="url" {...form.register('googleMapsUrl')} />}
        </Field>

        {/* Social media — a "Follow us" icon row on the public page. Every
            field is optional; blanks hide the corresponding icon. */}
        <div className="pt-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-body">
            Social media
          </h3>
          <p className="mt-1 text-[13px] text-muted">
            Add the profiles you want customers to find on your public page.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Instagram"
            optional
            error={form.formState.errors.instagramUrl?.message}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                placeholder="https://instagram.com/yourbusiness"
                {...form.register('instagramUrl')}
              />
            )}
          </Field>
          <Field
            label="Facebook"
            optional
            error={form.formState.errors.facebookUrl?.message}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                placeholder="https://facebook.com/yourbusiness"
                {...form.register('facebookUrl')}
              />
            )}
          </Field>
          <Field
            label="YouTube"
            optional
            error={form.formState.errors.youtubeUrl?.message}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                placeholder="https://youtube.com/@yourbusiness"
                {...form.register('youtubeUrl')}
              />
            )}
          </Field>
          <Field
            label="X (Twitter)"
            optional
            error={form.formState.errors.xUrl?.message}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                placeholder="https://x.com/yourbusiness"
                {...form.register('xUrl')}
              />
            )}
          </Field>
          <Field
            label="LinkedIn"
            optional
            error={form.formState.errors.linkedinUrl?.message}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                placeholder="https://linkedin.com/company/yourbusiness"
                {...form.register('linkedinUrl')}
              />
            )}
          </Field>
          <Field
            label="TikTok"
            optional
            error={form.formState.errors.tiktokUrl?.message}
          >
            {(p) => (
              <Input
                {...p}
                type="url"
                inputMode="url"
                placeholder="https://tiktok.com/@yourbusiness"
                {...form.register('tiktokUrl')}
              />
            )}
          </Field>
        </div>

        <Field
          label="WhatsApp"
          optional
          hint="This is your WhatsApp Business chat link — get it from wa.me or the WhatsApp app."
          error={form.formState.errors.whatsappUrl?.message}
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              placeholder="https://wa.me/919876543210"
              {...form.register('whatsappUrl')}
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={form.formState.isSubmitting}>
            <Menu className="size-4" /> Save info page
          </Button>
          <a
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-body hover:bg-surface-2"
          >
            Open public page <ExternalLink className="size-3.5" />
          </a>
        </div>
      </form>
    </Panel>
  );
}

// ── Menu-PDF uploader ────────────────────────────────────────────────────
// Camera-or-file picker that batches phone photos and POSTs them to
// /merchant/business/menu-pdf. Once a PDF exists, the plain "View-menu
// link" field above is disabled — everything flows through this control.

/** Client-side upload limits. Also enforced server-side; we surface a clear
 *  inline message before making the round-trip. */
const MENU_MAX_FILES = 20;
const MENU_MAX_PER_FILE_BYTES = 10 * 1024 * 1024;
const MENU_MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MENU_ACCEPT = 'image/jpeg,image/png,image/webp';

/** True when the stored menuUrl points at a PDF we generated ourselves. */
function isHostedMenuPdf(menuUrl: string | null): boolean {
  if (!menuUrl) return false;
  return /\/uploads\/menu\/[^/?#]+\.pdf(?:$|[?#])/.test(menuUrl);
}

interface PendingImage {
  file: File;
  previewUrl: string;
  key: string;
}

function MenuPdfUploader({ menuUrl }: { menuUrl: string | null }) {
  const queryClient = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const hasHostedPdf = isHostedMenuPdf(menuUrl);

  // Revoke object URLs when the component unmounts or the pending list is
  // replaced — otherwise the browser leaks a blob per preview thumbnail.
  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPending = () => {
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
    setError(null);
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setError(null);
    const next: PendingImage[] = [...pending];
    for (const file of Array.from(incoming)) {
      // iPhone HEIC arrives with mimetype image/heic — reject with the same
      // message the server uses so the merchant knows how to fix it.
      const mime = (file.type || '').toLowerCase();
      if (mime === 'image/heic' || mime === 'image/heif' || /\.hei[cf]$/i.test(file.name)) {
        setError(
          'HEIC/HEIF isn’t supported. On iPhone: Settings → Camera → Formats → Most Compatible, then reshoot. Or upload JPEGs instead.',
        );
        return;
      }
      if (mime && !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        setError('Only JPEG, PNG and WebP images are supported.');
        return;
      }
      if (file.size > MENU_MAX_PER_FILE_BYTES) {
        setError(`Each image must be under 10 MB (“${file.name}” is bigger).`);
        return;
      }
      next.push({
        file,
        previewUrl: URL.createObjectURL(file),
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      });
    }
    if (next.length > MENU_MAX_FILES) {
      setError(`Up to ${MENU_MAX_FILES} images per menu — that would make ${next.length}.`);
      return;
    }
    const total = next.reduce((sum, p) => sum + p.file.size, 0);
    if (total > MENU_MAX_TOTAL_BYTES) {
      setError('Total upload must be under 40 MB. Try fewer or smaller photos.');
      return;
    }
    setPending(next);
  };

  const removeAt = (index: number) => {
    setError(null);
    setPending((prev) => {
      const dropped = prev[index];
      if (dropped) URL.revokeObjectURL(dropped.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const move = (index: number, delta: -1 | 1) => {
    setPending((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const upload = useMutation({
    mutationFn: () => merchantApi.uploadMenuImages(pending.map((p) => p.file)),
    onSuccess: async () => {
      toast.success('Your menu PDF is ready');
      clearPending();
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'business-info'] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : 'Could not build the menu PDF.'),
  });

  const removePdf = useMutation({
    mutationFn: () => merchantApi.removeMenuPdf(),
    onSuccess: async () => {
      toast.success('Menu PDF removed');
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'business-info'] });
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : 'Could not remove the menu PDF.'),
  });

  return (
    <div className="rounded-xl border border-line bg-surface-2/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-strong">Upload menu images</p>
          <p className="text-[13px] text-muted">
            Shoot photos of your printed menu (or upload existing files) and we’ll turn them into
            one PDF. Up to {MENU_MAX_FILES} images, 10 MB each.
          </p>
        </div>
      </div>

      {hasHostedPdf && menuUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          <FileText className="size-4 shrink-0" />
          <span className="grow">Your menu PDF is ready.</span>
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:underline"
          >
            View menu PDF <ExternalLink className="size-3.5" />
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removePdf.mutate()}
            loading={removePdf.isPending}
          >
            <Trash2 className="size-4" /> Remove menu PDF
          </Button>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept={MENU_ACCEPT}
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={filesRef}
        type="file"
        accept={MENU_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => cameraRef.current?.click()}
          disabled={upload.isPending}
        >
          <Camera className="size-4" /> Take photos
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => filesRef.current?.click()}
          disabled={upload.isPending}
        >
          <FilePlus className="size-4" /> Choose files
        </Button>
        {/* Cross-device handoff: hand this workflow off to a phone camera in
            one scan. Same actor, no re-login. */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setHandoffOpen(true)}
          disabled={upload.isPending}
        >
          <Smartphone className="size-4" /> Open on phone
        </Button>
        {hasHostedPdf && (
          <span className="self-center text-[12px] text-muted">
            Adding new photos will replace the current PDF.
          </span>
        )}
      </div>

      <HandoffModal open={handoffOpen} onClose={() => setHandoffOpen(false)} />

      {error && (
        <p className="mt-2 text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <>
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {pending.map((p, index) => (
              <li
                key={p.key}
                className="group relative overflow-hidden rounded-lg border border-line bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt={`Page ${index + 1}`}
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  Page {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={`Remove page ${index + 1}`}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
                <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move page ${index + 1} up`}
                    className="rounded bg-black/60 p-1 text-white disabled:opacity-40"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === pending.length - 1}
                    aria-label={`Move page ${index + 1} down`}
                    className="rounded bg-black/60 p-1 text-white disabled:opacity-40"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => upload.mutate()}
              disabled={pending.length === 0 || upload.isPending}
              loading={upload.isPending}
            >
              <FileText className="size-4" />
              {hasHostedPdf ? 'Replace menu PDF' : 'Create menu PDF'}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearPending} disabled={upload.isPending}>
              Clear
            </Button>
            <span className="text-[12px] text-muted">
              {pending.length} of {MENU_MAX_FILES} images ·{' '}
              {Math.round(pending.reduce((s, p) => s + p.file.size, 0) / 1024 / 102.4) / 10} MB
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Cross-device handoff modal ───────────────────────────────────────────
// Shows a QR that opens Stamposa on the merchant's phone already signed in
// (WhatsApp-Web pattern). The QR is single-use, 5-min TTL — the server
// enforces both. This component just displays it and counts down.

function HandoffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open on phone"
      description="Scan the QR to shoot menu photos from your phone — you'll land right back here, already signed in."
    >
      {open && <HandoffModalBody onClose={onClose} />}
    </Modal>
  );
}

function HandoffModalBody({ onClose }: { onClose: () => void }) {
  const handoff = useMutation<HandoffCreated, ApiError>({
    mutationFn: () => merchantApi.createHandoff('/merchant/settings#menu-pdf'),
  });

  // Fire the request once when the modal opens. Passing the mutation function
  // directly instead of a dep-listed effect keeps StrictMode from firing
  // twice on remount (which would burn two throwaway tokens).
  useEffect(() => {
    handoff.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!handoff.data) {
      setSecondsLeft(null);
      return;
    }
    const expiresAtMs = new Date(handoff.data.expiresAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [handoff.data]);

  const expired = secondsLeft !== null && secondsLeft <= 0;

  if (handoff.isPending || (!handoff.data && !handoff.isError)) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="size-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-sm text-muted">Preparing your one-time sign-in code…</p>
      </div>
    );
  }

  if (handoff.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertTriangle className="size-6 text-amber-500" />
        <p className="text-sm text-strong">Couldn’t generate the code.</p>
        <p className="text-[13px] text-muted">
          {handoff.error?.message ?? 'Please try again in a moment.'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => handoff.mutate()}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </div>
    );
  }

  const data = handoff.data!;
  return (
    <div className="flex flex-col items-center gap-4">
      {expired ? (
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-line bg-canvas p-6 text-center">
          <AlertTriangle className="size-7 text-amber-500" />
          <p className="text-sm font-semibold text-strong">Code expired</p>
          <p className="text-[13px] text-muted">
            One-time codes are good for five minutes. Generate a fresh one below.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handoff.mutate()}
            loading={handoff.isPending}
          >
            <RefreshCw className="size-4" /> Generate new code
          </Button>
        </div>
      ) : (
        <>
          {/* White card so any phone camera reads the QR fast. */}
          <div
            className="flex size-64 items-center justify-center rounded-2xl border border-line bg-white p-3"
            // The QR SVG is server-generated by the `qrcode` library, sanitised
            // by construction — the encoded content is a URL we just built,
            // not user input. Same pattern the wallet-pass renderer uses.
            dangerouslySetInnerHTML={{ __html: data.qrSvg }}
            aria-label="Sign-in QR code — scan with your phone camera"
            role="img"
          />
          <div className="text-center">
            <p className="text-sm text-strong">Scan with your phone camera.</p>
            <p className="mt-1 text-[13px] text-muted">
              This code works for{' '}
              <span className="font-mono font-semibold text-strong">
                {formatMmSs(secondsLeft ?? data.expiresInSec)}
              </span>{' '}
              — single-use.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      )}
    </div>
  );
}

function formatMmSs(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}
