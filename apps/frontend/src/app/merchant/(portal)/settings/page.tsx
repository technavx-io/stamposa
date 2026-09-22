'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  FilePlus,
  FileText,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  Palette,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@stamposa/ui/lib/utils';
import { ApiError } from '@/lib/api/client';
import { merchantApi, type HandoffCreated } from '@/lib/api/endpoints';
import { useMerchant } from '@/lib/auth/merchant-context';
import { downloadAuthenticated } from '@/lib/download';
import { PageHeader } from '@/components/layout/page-header';
import { StampGrid } from '@/components/stamp-grid';
import { Button } from '@stamposa/ui/components/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/surface';
import {
  CardImageField,
  EmojiChoice,
  REWARD_EMOJIS,
  STAMP_EMOJIS,
} from '@/components/merchant/card-style-fields';
import { cardBackground } from '@/lib/card-bg';
import { SectionNav, type SectionNavItem } from '@/components/settings/section-nav';
import { SectionShell, useSaveFlash } from '@/components/settings/section-shell';

// ── Section registry ────────────────────────────────────────────────────
// Reflect the active pane in `?section=` so a merchant can send a link that
// opens straight to Menu. Also the answer to "what tab was I on before I
// reloaded".

const SECTION_KEYS = [
  'business',
  'public',
  'menu',
  'social',
  'look',
  'notifications',
  'danger',
] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

function isSectionKey(v: string | null): v is SectionKey {
  return !!v && (SECTION_KEYS as readonly string[]).includes(v);
}

// ── Timezone / category dictionaries — unchanged ────────────────────────

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

const swatches = [
  '#4F46E5',
  '#0D9488',
  '#B45309',
  '#BE123C',
  '#7C3AED',
  '#0369A1',
  '#15803D',
  '#1F2937',
];

// ── Zod schemas — UNCHANGED shape/paths ─────────────────────────────────

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Business name is required').max(80),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  category: z.string().trim().max(40).optional().or(z.literal('')),
  timezone: z.string().trim().max(64),
});
type BusinessFormValues = z.infer<typeof businessSchema>;

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

// ── Page entry ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="size-6" />
    </div>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const querySection = params.get('section');
  const active: SectionKey = isSectionKey(querySection) ? querySection : 'business';

  const selectSection = (key: SectionKey) => {
    const q = new URLSearchParams(params.toString());
    q.set('section', key);
    // scroll:false + replace so the change feels like a tab, not a nav.
    router.replace(`/merchant/settings?${q.toString()}`, { scroll: false });
    // Fresh chrome — scroll to the pane top on section change so the header
    // is always the first thing under the merchant's eye.
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nav: SectionNavItem[] = [
    { key: 'business', label: 'Business', icon: Building2 },
    { key: 'public', label: 'Public page', icon: Globe },
    { key: 'menu', label: 'Menu', icon: FileText },
    { key: 'social', label: 'Social', icon: Share2 },
    { key: 'look', label: 'Card look', icon: Palette },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'danger', label: 'Danger', icon: ShieldAlert, tone: 'danger' },
  ];

  return (
    <div className="relative">
      {/* Ambient layer — three enormous, VERY soft radial glows fixed behind
          the entire content area. Static (no motion, no aurora churn) so a
          dense settings surface stays legible, but the flat page picks up
          depth and colour hints of the brand palette. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-32 size-[640px] rounded-full bg-brand-500/[0.07] blur-3xl dark:bg-brand-500/[0.12]" />
        <div className="absolute -bottom-40 -left-32 size-[560px] rounded-full bg-amber-400/[0.06] blur-3xl dark:bg-amber-400/[0.08]" />
        <div className="absolute top-1/2 left-1/4 size-[480px] -translate-y-1/2 rounded-full bg-violet-500/[0.05] blur-3xl dark:bg-violet-500/[0.09]" />
      </div>

      <PageHeader
        title="Settings"
        description="Everything your customers see, and how you're set up behind the counter."
      />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <SectionNav items={nav} active={active} onSelect={(k) => selectSection(k as SectionKey)} />

        <div className="min-w-0">
          {active === 'business' && <BusinessSection />}
          {active === 'public' && <PublicPageSection />}
          {active === 'menu' && <MenuSection />}
          {active === 'social' && <SocialSection />}
          {active === 'look' && <CardLookSection />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'danger' && <DangerSection />}
        </div>
      </div>
    </div>
  );
}

// ── Business section ────────────────────────────────────────────────────
// Business identity + logo + timezone + consent + data exports.

function BusinessSection() {
  const { me, business, refresh } = useMerchant();
  const fileRef = useRef<HTMLInputElement>(null);
  const flash = useSaveFlash();
  const logoFlash = useSaveFlash();
  const consentFlash = useSaveFlash();
  const [consentText, setConsentText] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
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
      flash.flash();
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the profile.');
    }
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => merchantApi.uploadLogo(file),
    onSuccess: async () => {
      toast.success('Logo updated');
      logoFlash.flash();
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Upload failed.'),
  });

  const removeLogo = useMutation({
    mutationFn: () => merchantApi.removeLogo(),
    onSuccess: async () => {
      toast.success('Logo removed');
      logoFlash.flash();
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not remove the logo.'),
  });

  const saveConsent = useMutation({
    mutationFn: (text: string) => merchantApi.updateBusiness({ consentText: text }),
    onSuccess: async () => {
      toast.success('Consent wording saved');
      consentFlash.flash();
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save.'),
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
    <div className="space-y-6">
      <SectionShell
        id="business"
        eyebrow="Identity"
        title="Business profile"
        description="Your business name, contact, and default timezone. This is the record everything else hangs off."
        flashRing={flash.ringClass}
      >
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="flex flex-col items-start gap-3">
              <LogoAvatar name={business.name} logoUrl={business.logoUrl} size="xl" />
              <div
                className={cn(
                  'rounded-lg transition-shadow duration-500',
                  logoFlash.ringClass,
                )}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo.mutate(f);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={uploadLogo.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus className="size-4" /> {business.logoUrl ? 'Replace' : 'Upload logo'}
                  </Button>
                  {business.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={removeLogo.isPending}
                      onClick={() => removeLogo.mutate()}
                    >
                      <Trash2 className="size-4" /> Remove
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-[12px] text-muted">PNG, JPEG, WebP · up to 2 MB.</p>
              </div>
            </div>

            <div className="space-y-4">
              <Field
                label="Business name"
                hint="The name your customers see when they scan your QR."
                error={form.formState.errors.name?.message}
              >
                {(p) => <Input {...p} {...form.register('name')} />}
              </Field>
              <Field
                label="Address"
                optional
                hint="Where you're located. Also shown on your public page."
                error={form.formState.errors.address?.message}
              >
                {(p) => <Textarea {...p} rows={2} {...form.register('address')} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Business phone"
                  optional
                  error={form.formState.errors.phone?.message}
                >
                  {(p) => <Input {...p} type="tel" {...form.register('phone')} />}
                </Field>
                <Field label="Category" optional hint="Helps us pick sensible defaults for you.">
                  {(p) => (
                    <select
                      {...p}
                      {...form.register('category')}
                      className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-strong focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
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
                    className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-strong focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </div>

          <DirtyBar
            dirty={form.formState.isDirty}
            saving={form.formState.isSubmitting}
            onCancel={() => form.reset()}
            submitLabel="Save profile"
          />
        </form>
      </SectionShell>

      <SectionShell
        id="business-consent"
        title="Consent wording"
        description="What customers agree to when they join. Editing starts a new version — past agreements keep the text they saw."
        flashRing={consentFlash.ringClass}
      >
        <div className="space-y-3">
          <Textarea
            rows={3}
            value={consentText ?? business.consentText ?? ''}
            onChange={(e) => setConsentText(e.target.value)}
            placeholder={`I agree to ${business.name} contacting me with offers and updates. I can unsubscribe at any time.`}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              loading={saveConsent.isPending}
              disabled={consentText === null || consentText === (business.consentText ?? '')}
              onClick={() => saveConsent.mutate(consentText ?? '')}
            >
              Save wording
            </Button>
            {consentText !== null && consentText !== (business.consentText ?? '') && (
              <button
                type="button"
                className="text-[13px] font-medium text-muted hover:text-strong"
                onClick={() => setConsentText(null)}
              >
                Discard
              </button>
            )}
          </div>
        </div>
      </SectionShell>

      <SectionShell
        id="business-data"
        title="Your data"
        description="Your customer list, transactions, and rewards — yours to take at any time, on any plan."
      >
        <div className="flex flex-wrap gap-2">
          {(['customers', 'transactions', 'rewards'] as const).map((key) => (
            <Button
              key={key}
              variant="secondary"
              size="sm"
              loading={downloading === key}
              onClick={() => void download(key)}
            >
              <Download className="size-4" /> Export {key}.csv
            </Button>
          ))}
        </div>
        <dl className="mt-6 space-y-2 border-t border-line-soft pt-4 text-sm">
          <RowKv label="Owner" value={me.actor.name ?? '—'} />
          <RowKv label="Login email" value={me.actor.email ?? '—'} />
          <RowKv label="Join link" value={business.joinUrl} mono />
        </dl>
      </SectionShell>
    </div>
  );
}

function RowKv({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd
        className={cn(
          'max-w-[60%] truncate text-right font-medium text-strong',
          mono && 'font-mono text-xs text-body',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Sticky-ish footer bar that only appears when the form is dirty. Keeps the
 *  save action reachable without hunting for it, and lets the merchant back
 *  out of edits without a page reload. */
function DirtyBar({
  dirty,
  saving,
  onCancel,
  submitLabel,
}: {
  dirty: boolean;
  saving: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-line-soft pt-4 transition-opacity',
        dirty ? 'opacity-100' : 'pointer-events-none opacity-60',
      )}
    >
      {dirty && (
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] font-medium text-muted hover:text-strong"
        >
          Discard changes
        </button>
      )}
      <Button type="submit" loading={saving} disabled={!dirty}>
        {submitLabel}
      </Button>
    </div>
  );
}

// ── Public page section — the /b/<slug> non-menu fields ─────────────────

function PublicPageSection() {
  const { business } = useMerchant();
  const queryClient = useQueryClient();
  const flash = useSaveFlash();
  const reviewFlash = useSaveFlash();
  const [reviewLink, setReviewLink] = useState<string | null>(null);

  const info = useQuery({
    queryKey: ['merchant', 'business-info'],
    queryFn: merchantApi.businessInfo,
  });

  const form = useForm<InfoFormValues>({
    resolver: zodResolver(infoSchema),
    values: infoFormValues(info.data),
    resetOptions: { keepDirtyValues: true },
  });

  const publicHref = `/b/${business.slug}`;

  const save = form.handleSubmit(async (values) => {
    try {
      await merchantApi.updateBusinessInfo(applyInfoValues(values));
      toast.success('Public page saved');
      flash.flash();
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'business-info'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save the info page.');
    }
  });

  const saveReview = useMutation({
    mutationFn: (url: string) => merchantApi.updateBusiness({ googleReviewUrl: url }),
    onSuccess: async () => {
      toast.success('Review link saved');
      reviewFlash.flash();
      setReviewLink(null);
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save.'),
  });

  if (info.isPending) return <SkeletonPanel />;

  return (
    <div className="space-y-6">
      <SectionShell
        id="public"
        eyebrow="Public"
        title="Your public page"
        description="A single page for your business — link it from Instagram bio, receipts, anywhere. Skip a field and it just hides."
        publicHref={publicHref}
        flashRing={flash.ringClass}
      >
        <form onSubmit={save} className="space-y-4">
          <Field
            label="About the business"
            optional
            hint="One or two lines — what makes you you."
            error={form.formState.errors.aboutText?.message}
          >
            {(p) => <Textarea {...p} rows={3} {...form.register('aboutText')} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" optional error={form.formState.errors.address?.message}>
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

          <Field label="Website" optional error={form.formState.errors.websiteUrl?.message}>
            {(p) => <Input {...p} type="url" inputMode="url" {...form.register('websiteUrl')} />}
          </Field>

          <Field
            label="Google Maps link"
            optional
            hint="Powers the “Open in Maps” button. If blank, we fall back to the address."
            error={form.formState.errors.googleMapsUrl?.message}
          >
            {(p) => <Input {...p} type="url" inputMode="url" {...form.register('googleMapsUrl')} />}
          </Field>

          <DirtyBar
            dirty={form.formState.isDirty}
            saving={form.formState.isSubmitting}
            onCancel={() => form.reset()}
            submitLabel="Save public page"
          />
        </form>
      </SectionShell>

      <SectionShell
        id="public-review"
        title="Google reviews"
        description="Add your review link and every customer card gets a “Leave a Google review” button."
        flashRing={reviewFlash.ringClass}
      >
        <div className="space-y-3">
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
              loading={saveReview.isPending}
              disabled={
                reviewLink === null || reviewLink.trim() === (business.googleReviewUrl ?? '')
              }
              onClick={() => saveReview.mutate(reviewLink?.trim() ?? '')}
            >
              Save link
            </Button>
            {business.googleReviewUrl && (
              <a
                href={business.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                <Star className="size-4" /> Open review page
              </a>
            )}
          </div>
        </div>
      </SectionShell>
    </div>
  );
}

// ── Menu section — the star of the pitch ────────────────────────────────

function MenuSection() {
  const { business } = useMerchant();
  const queryClient = useQueryClient();
  const flash = useSaveFlash();

  const info = useQuery({
    queryKey: ['merchant', 'business-info'],
    queryFn: merchantApi.businessInfo,
  });

  const [externalMenu, setExternalMenu] = useState<string | null>(null);
  const publicHref = `/b/${business.slug}`;

  const menuUrl = info.data?.menuUrl ?? '';
  const hosted = isHostedMenuPdf(info.data?.menuUrl ?? null);

  const saveExternal = useMutation({
    mutationFn: (url: string) => merchantApi.updateBusinessInfo({ menuUrl: url }),
    onSuccess: async () => {
      toast.success('Menu link saved');
      flash.flash();
      setExternalMenu(null);
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'business-info'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save.'),
  });

  if (info.isPending) return <SkeletonPanel />;

  return (
    <div className="space-y-6">
      <SectionShell
        id="menu"
        eyebrow="Star feature"
        title="Your menu"
        description="Point customers at your menu the moment they land on your public page. Shoot it from your phone — we'll stitch the photos into a PDF."
        publicHref={publicHref}
      >
        <MenuPdfUploaderHero menuUrl={info.data?.menuUrl ?? null} />
      </SectionShell>

      <SectionShell
        id="menu-link"
        title="Or link to a menu that lives elsewhere"
        description="Zomato, Instagram post, PDF on Drive — anywhere. When you upload photos above, we hide this."
        flashRing={flash.ringClass}
      >
        {hosted ? (
          <div className="flex items-start gap-3 rounded-lg border border-line-soft bg-surface-2/50 p-3 text-[13px] text-muted">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            <div>
              Your menu is set from the uploaded PDF.
              {menuUrl && (
                <>
                  {' '}
                  <a
                    href={menuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    View it here
                  </a>
                  .
                </>
              )}{' '}
              Remove the PDF to set an external link instead.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Menu link" optional>
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  inputMode="url"
                  placeholder="https://www.zomato.com/…"
                  value={externalMenu ?? menuUrl}
                  onChange={(e) => setExternalMenu(e.target.value)}
                />
              )}
            </Field>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                loading={saveExternal.isPending}
                disabled={externalMenu === null || externalMenu === menuUrl}
                onClick={() => saveExternal.mutate((externalMenu ?? '').trim())}
              >
                Save link
              </Button>
              {menuUrl && !externalMenu && (
                <a
                  href={menuUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                >
                  Open current menu <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </SectionShell>
    </div>
  );
}

// ── Social section — split out; two-column layout ───────────────────────

function SocialSection() {
  const { business } = useMerchant();
  const queryClient = useQueryClient();
  const flash = useSaveFlash();

  const info = useQuery({
    queryKey: ['merchant', 'business-info'],
    queryFn: merchantApi.businessInfo,
  });

  const form = useForm<InfoFormValues>({
    resolver: zodResolver(infoSchema),
    values: infoFormValues(info.data),
    resetOptions: { keepDirtyValues: true },
  });

  const save = form.handleSubmit(async (values) => {
    try {
      await merchantApi.updateBusinessInfo(applyInfoValues(values));
      toast.success('Social links saved');
      flash.flash();
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'business-info'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save.');
    }
  });

  if (info.isPending) return <SkeletonPanel />;

  const socialFields: Array<{
    label: string;
    name: keyof InfoFormValues;
    placeholder: string;
  }> = [
    { label: 'Instagram', name: 'instagramUrl', placeholder: 'https://instagram.com/yourbusiness' },
    { label: 'Facebook', name: 'facebookUrl', placeholder: 'https://facebook.com/yourbusiness' },
    { label: 'WhatsApp', name: 'whatsappUrl', placeholder: 'https://wa.me/919876543210' },
    { label: 'YouTube', name: 'youtubeUrl', placeholder: 'https://youtube.com/@yourbusiness' },
    { label: 'TikTok', name: 'tiktokUrl', placeholder: 'https://tiktok.com/@yourbusiness' },
    { label: 'X (Twitter)', name: 'xUrl', placeholder: 'https://x.com/yourbusiness' },
    {
      label: 'LinkedIn',
      name: 'linkedinUrl',
      placeholder: 'https://linkedin.com/company/yourbusiness',
    },
  ];

  const allEmpty = socialFields.every((f) => !(info.data?.[f.name] ?? ''));

  return (
    <SectionShell
      id="social"
      eyebrow="Reach"
      title="Social media"
      description="These appear as icons on your public page. Blank fields are hidden — no dead icons."
      publicHref={`/b/${business.slug}`}
      flashRing={flash.ringClass}
    >
      <form onSubmit={save} className="space-y-4">
        {allEmpty && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            Add your Instagram, WhatsApp and Facebook first — those three usually cover most
            customers, and they&apos;ll show up as tap-to-open icons on your public page.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {socialFields.map((f) => (
            <Field
              key={f.name}
              label={f.label}
              optional
              error={form.formState.errors[f.name]?.message as string | undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  inputMode="url"
                  placeholder={f.placeholder}
                  {...form.register(f.name)}
                />
              )}
            </Field>
          ))}
        </div>
        <DirtyBar
          dirty={form.formState.isDirty}
          saving={form.formState.isSubmitting}
          onCancel={() => form.reset()}
          submitLabel="Save social links"
        />
      </form>
    </SectionShell>
  );
}

// ── Card look section ───────────────────────────────────────────────────

function CardLookSection() {
  const { business, refresh } = useMerchant();
  const flash = useSaveFlash();

  const [brandColor, setBrandColor] = useState(business.brandColor ?? '#4F46E5');
  const [stampIcon, setStampIcon] = useState(business.stampIcon ?? '');
  const [rewardIcon, setRewardIcon] = useState(business.rewardIcon ?? '');
  const [imageTint, setImageTint] = useState(business.cardImageTint);

  // If the business updates elsewhere, keep the local state in sync so a save
  // in another tab doesn't leave stale colour in memory here.
  useEffect(() => {
    setBrandColor(business.brandColor ?? '#4F46E5');
    setStampIcon(business.stampIcon ?? '');
    setRewardIcon(business.rewardIcon ?? '');
    setImageTint(business.cardImageTint);
  }, [business.brandColor, business.stampIcon, business.rewardIcon, business.cardImageTint]);

  const dirty =
    brandColor.toLowerCase() !== (business.brandColor ?? '').toLowerCase() ||
    stampIcon !== (business.stampIcon ?? '') ||
    rewardIcon !== (business.rewardIcon ?? '') ||
    imageTint !== business.cardImageTint;

  const save = useMutation({
    mutationFn: () =>
      merchantApi.updateBusiness({
        brandColor,
        stampIcon: stampIcon || null,
        rewardIcon: rewardIcon || null,
        cardImageTint: imageTint,
      }),
    onSuccess: async () => {
      toast.success('Card look saved');
      flash.flash();
      await refresh();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save.'),
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
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not remove.'),
  });

  return (
    <SectionShell
      id="look"
      eyebrow="Brand"
      title="Card & rewards look"
      description="How your stamp card feels in customers' hands. Individual campaigns can override these defaults."
      flashRing={flash.ringClass}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column — controls */}
        <div className="space-y-6">
          <div>
            <p className="text-[13px] font-semibold text-strong">Brand colour</p>
            <p className="mt-0.5 text-[12px] text-muted">
              The card gradient and stamp fill both key off this.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {swatches.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setBrandColor(hex)}
                  aria-label={`Choose ${hex}`}
                  className={cn(
                    'size-8 cursor-pointer rounded-lg ring-offset-2 ring-offset-surface transition-all',
                    brandColor.toLowerCase() === hex.toLowerCase()
                      ? 'ring-2 ring-strong'
                      : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent"
                aria-label="Custom colour"
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-9 max-w-[140px] font-mono text-[13px]"
                maxLength={7}
              />
            </div>
          </div>

          <div className="border-t border-line-soft pt-4">
            <p className="text-[13px] font-semibold text-strong">Stamp icon</p>
            <p className="mt-0.5 text-[12px] text-muted">
              Punched onto the card every time a customer earns a stamp.
            </p>
            <div className="mt-3">
              <EmojiChoice
                value={stampIcon}
                onChange={setStampIcon}
                presets={STAMP_EMOJIS}
                defaultHint="Using the default check mark."
              />
            </div>
          </div>

          <div className="border-t border-line-soft pt-4">
            <p className="text-[13px] font-semibold text-strong">Reward icon</p>
            <p className="mt-0.5 text-[12px] text-muted">
              Sits in the reward slot at the end of the card.
            </p>
            <div className="mt-3">
              <EmojiChoice
                value={rewardIcon}
                onChange={setRewardIcon}
                presets={REWARD_EMOJIS}
                defaultHint="Using the default gift."
              />
            </div>
          </div>

          <div className="border-t border-line-soft pt-4">
            <p className="text-[13px] font-semibold text-strong">Card background image</p>
            <p className="mt-0.5 text-[12px] text-muted">
              Optional — put your product or your storefront behind the stamps. PNG, JPEG or WebP,
              up to 4 MB.
            </p>
            <div className="mt-3 space-y-3">
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
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
            {dirty && (
              <button
                type="button"
                className="text-[13px] font-medium text-muted hover:text-strong"
                onClick={() => {
                  setBrandColor(business.brandColor ?? '#4F46E5');
                  setStampIcon(business.stampIcon ?? '');
                  setRewardIcon(business.rewardIcon ?? '');
                  setImageTint(business.cardImageTint);
                }}
              >
                Discard changes
              </button>
            )}
            <Button loading={save.isPending} disabled={!dirty} onClick={() => save.mutate()}>
              Save card look
            </Button>
          </div>
        </div>

        {/* Right column — live preview. Sticks on the desktop so it stays
            visible while the merchant fiddles with icons and swatches. */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Live preview
          </p>
          <div
            className="rounded-2xl bg-cover bg-center p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
            style={{
              background: cardBackground({
                color: brandColor,
                cardImageUrl: business.cardImageUrl,
                imageTinted: imageTint,
              }),
            }}
          >
            <div className="flex items-center gap-2">
              <LogoAvatar name={business.name} logoUrl={business.logoUrl} size="sm" />
              <div>
                <p className="text-sm font-semibold">{business.name}</p>
                <p className="text-[11px] text-white/70">Preview</p>
              </div>
            </div>
            <div className="mt-4">
              <StampGrid
                total={8}
                filled={3}
                size="sm"
                tone="dark"
                stampIcon={stampIcon || null}
                rewardIcon={rewardIcon || null}
              />
            </div>
            <p className="mt-3 text-[11px] text-white/70">3 of 8 stamps · reward at 8</p>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

// ── Notifications section ───────────────────────────────────────────────

function NotificationsSection() {
  const { business, refresh } = useMerchant();
  const queryClient = useQueryClient();
  const flash = useSaveFlash();

  const toggle = useMutation({
    mutationFn: (patch: Record<string, boolean>) => merchantApi.updateBusiness(patch),
    onSuccess: async () => {
      flash.flash();
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save.'),
  });

  const items = [
    {
      key: 'notifyDailySummary' as const,
      label: 'Daily summary',
      description: 'A short recap of yesterday each morning.',
    },
    {
      key: 'notifyWeeklyDigest' as const,
      label: 'Weekly digest',
      description: 'How the week went, delivered every Monday.',
    },
    {
      key: 'notifyStaffInactive' as const,
      label: 'Staff inactivity alerts',
      description: 'Ping us if nobody has stamped in 48 hours.',
    },
  ];

  return (
    <SectionShell
      id="notifications"
      eyebrow="Alerts"
      title="Email notifications"
      description="What Stamposa emails you about your programme. Toggle any time — takes effect immediately."
      flashRing={flash.ringClass}
    >
      <ul className="divide-y divide-line-soft">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
            <div>
              <p className="text-sm font-medium text-strong">{item.label}</p>
              <p className="text-[13px] text-muted">{item.description}</p>
            </div>
            <Switch
              checked={business[item.key]}
              onCheckedChange={(next) => toggle.mutate({ [item.key]: next })}
              aria-label={item.label}
            />
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

// ── Danger section — pause only. Exports moved to Business > Your data ──

function DangerSection() {
  const queryClient = useQueryClient();
  const [pauseOpen, setPauseOpen] = useState(false);
  const flash = useSaveFlash();

  const campaigns = useQuery({
    queryKey: ['merchant', 'campaigns'],
    queryFn: merchantApi.listCampaigns,
  });
  const liveCampaign = campaigns.data?.find((c) => c.status !== 'ARCHIVED') ?? null;

  const togglePause = useMutation({
    mutationFn: () =>
      merchantApi.updateCampaign(liveCampaign!.id, {
        status: liveCampaign!.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
      }),
    onSuccess: async (c) => {
      toast.success(c.status === 'ACTIVE' ? 'Programme resumed' : 'Programme paused');
      setPauseOpen(false);
      flash.flash();
      await queryClient.invalidateQueries({ queryKey: ['merchant'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update.'),
  });

  return (
    <>
      <SectionShell
        id="danger"
        eyebrow="Careful"
        title="Danger zone"
        description="Actions that affect live customers. We ask twice."
        flashRing={flash.ringClass}
        className="border-red-200/70 dark:border-red-500/25"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-strong">
              {liveCampaign?.status === 'PAUSED'
                ? 'Programme is paused'
                : 'Pause the programme'}
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
      </SectionShell>

      <Modal
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Pause the programme?"
        description="New customers can't join and staff can't add stamps. Existing cards and rewards stay exactly as they are."
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Your QR code will show “not accepting new members” until you resume.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPauseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={togglePause.isPending}
              onClick={() => togglePause.mutate()}
            >
              <Pause className="size-4" /> Pause programme
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Menu PDF uploader — promoted hero ───────────────────────────────────
// Same POSTs and validation as before; the framing is bigger and the three
// input paths (take, choose, open on phone) are equally weighted.

const MENU_MAX_FILES = 20;
const MENU_MAX_PER_FILE_BYTES = 10 * 1024 * 1024;
const MENU_MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MENU_ACCEPT = 'image/jpeg,image/png,image/webp';

function isHostedMenuPdf(menuUrl: string | null): boolean {
  if (!menuUrl) return false;
  return /\/uploads\/menu\/[^/?#]+\.pdf(?:$|[?#])/.test(menuUrl);
}

interface PendingImage {
  file: File;
  previewUrl: string;
  key: string;
}

function MenuPdfUploaderHero({ menuUrl }: { menuUrl: string | null }) {
  const queryClient = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);

  const hosted = isHostedMenuPdf(menuUrl);

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
    <div className="space-y-4">
      {hosted && menuUrl && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Your menu PDF is live.</p>
            <p className="text-[12.5px] opacity-90">
              Customers see it right on your public page.
            </p>
          </div>
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700"
          >
            View PDF <ExternalLink className="size-3.5" />
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removePdf.mutate()}
            loading={removePdf.isPending}
          >
            <Trash2 className="size-4" /> Remove
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

      {/* Three equally-weighted paths — a real "add menu" hero */}
      <div className="grid gap-3 sm:grid-cols-3">
        <UploadTile
          icon={Camera}
          title="Take photos"
          hint="Snap each page with your phone"
          onClick={() => cameraRef.current?.click()}
          disabled={upload.isPending}
        />
        <UploadTile
          icon={FilePlus}
          title="Choose files"
          hint="Pick images from this device"
          onClick={() => filesRef.current?.click()}
          disabled={upload.isPending}
        />
        <UploadTile
          icon={Smartphone}
          title="Open on phone"
          hint="Handoff via QR — 5 min token"
          onClick={() => setHandoffOpen(true)}
          disabled={upload.isPending}
          accent
        />
      </div>

      <p className="text-[12.5px] text-muted">
        Up to {MENU_MAX_FILES} images · 10 MB each · 40 MB total. We stitch them into one PDF and
        set it as your menu.
        {hosted && ' Adding new photos replaces the current PDF.'}
      </p>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      <HandoffModal open={handoffOpen} onClose={() => setHandoffOpen(false)} />

      {pending.length > 0 && (
        <div className="rounded-xl border border-line bg-surface-2/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-strong">
              {pending.length} of {MENU_MAX_FILES} pages ready
            </p>
            <p className="text-[12px] text-muted">
              {Math.round(pending.reduce((s, p) => s + p.file.size, 0) / 1024 / 102.4) / 10} MB
            </p>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
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
                <span className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  Page {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  aria-label={`Remove page ${index + 1}`}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
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
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => upload.mutate()}
              disabled={pending.length === 0 || upload.isPending}
              loading={upload.isPending}
            >
              <FileText className="size-4" />
              {hosted ? 'Replace menu PDF' : 'Create menu PDF'}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearPending} disabled={upload.isPending}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {!hosted && pending.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-surface-2/30 px-4 py-6 text-center">
          <ImageIcon className="mx-auto size-6 text-muted" />
          <p className="mt-2 text-[13.5px] font-medium text-strong">No menu yet</p>
          <p className="mt-1 text-[12.5px] text-muted">
            Shoot the pages of your printed menu — one photo per page, we handle the rest.
          </p>
        </div>
      )}
    </div>
  );
}

function UploadTile({
  icon: Icon,
  title,
  hint,
  onClick,
  disabled,
  accent,
}: {
  icon: typeof Camera;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex flex-col items-start gap-2 overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60',
        // Layered shadow stack — inset top-highlight + close definition
        // + long ambient lift. The tiles were previously flat; this gives
        // the three primary paths real presence.
        'shadow-[0_1px_0_rgba(255,255,255,0.55)_inset,0_1px_2px_rgba(15,23,42,0.05),0_10px_24px_-14px_rgba(15,23,42,0.16)]',
        'dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_1px_3px_rgba(0,0,0,0.4),0_16px_40px_-16px_rgba(0,0,0,0.55)]',
        'enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_2px_4px_rgba(15,23,42,0.06),0_24px_60px_-16px_rgba(79,70,229,0.28)]',
        'dark:enabled:hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_2px_6px_rgba(0,0,0,0.45),0_24px_64px_-16px_rgba(99,102,241,0.45)]',
        accent
          ? 'border-brand-500/40 bg-gradient-to-b from-brand-50 to-brand-100/70 hover:border-brand-500/60 dark:from-brand-500/[0.12] dark:to-brand-500/[0.06] dark:hover:from-brand-500/[0.18]'
          : 'border-line bg-surface hover:border-brand-500/40',
      )}
    >
      {/* Whisper of a radial glow that swells on hover — signals "this tile
          is the one your mouse is on" without being loud. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-0 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(99,102,241,0.22), transparent 60%)',
        }}
      />
      <div
        className={cn(
          'relative flex size-9 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105',
          accent
            ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_16px_-6px_rgba(79,70,229,0.45)]'
            : 'bg-surface-2 text-brand-600 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] dark:bg-brand-500/20 dark:text-brand-200 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]',
        )}
      >
        <Icon className="size-4.5" />
      </div>
      <div className="relative">
        <p className="text-sm font-semibold tracking-tight text-strong">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{hint}</p>
      </div>
    </button>
  );
}

// ── Handoff modal — same behaviour, unchanged ───────────────────────────

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
    mutationFn: () => merchantApi.createHandoff('/merchant/settings?section=menu'),
  });

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
          <div
            className="flex size-64 items-center justify-center rounded-2xl border border-line bg-white p-3"
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

// ── Shared helpers ──────────────────────────────────────────────────────

function infoFormValues(data: {
  menuUrl?: string | null;
  aboutText?: string | null;
  address?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  hoursText?: string | null;
  contactEmail?: string | null;
  googleMapsUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  xUrl?: string | null;
  linkedinUrl?: string | null;
  tiktokUrl?: string | null;
  whatsappUrl?: string | null;
} | undefined): InfoFormValues {
  return {
    menuUrl: data?.menuUrl ?? '',
    aboutText: data?.aboutText ?? '',
    address: data?.address ?? '',
    phone: data?.phone ?? '',
    websiteUrl: data?.websiteUrl ?? '',
    hoursText: data?.hoursText ?? '',
    contactEmail: data?.contactEmail ?? '',
    googleMapsUrl: data?.googleMapsUrl ?? '',
    instagramUrl: data?.instagramUrl ?? '',
    facebookUrl: data?.facebookUrl ?? '',
    youtubeUrl: data?.youtubeUrl ?? '',
    xUrl: data?.xUrl ?? '',
    linkedinUrl: data?.linkedinUrl ?? '',
    tiktokUrl: data?.tiktokUrl ?? '',
    whatsappUrl: data?.whatsappUrl ?? '',
  };
}

/** The API treats "" as clear-this-field; we forward as-is. */
function applyInfoValues(values: InfoFormValues) {
  return {
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
  };
}

function SkeletonPanel() {
  return (
    <div className="animate-pulse rounded-2xl border border-line/80 bg-surface p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="h-5 w-40 rounded bg-surface-2" />
      <div className="mt-2 h-3 w-64 rounded bg-surface-2" />
      <div className="mt-6 space-y-3">
        <div className="h-10 rounded bg-surface-2" />
        <div className="h-10 rounded bg-surface-2" />
        <div className="h-20 rounded bg-surface-2" />
      </div>
    </div>
  );
}

