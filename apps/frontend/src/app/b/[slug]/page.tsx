import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Mail, MapPin, Menu, Phone, Sparkles } from 'lucide-react';
import { API_URL } from '@/lib/api/client';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { AuroraBackdrop, GridPattern, auroraStyles } from '@/components/auth/aurora-visuals';
import type { PublicBusinessInfo } from '@/lib/api/types';

/**
 * Server-fetch of the info-page payload. The API 404s for unknown or
 * suspended businesses; a fetch failure (API down) surfaces as null so the
 * page renders `notFound()` rather than crashing.
 */
async function fetchBusinessInfo(slug: string): Promise<PublicBusinessInfo | null> {
  try {
    const res = await fetch(
      `${API_URL}/v1/public/businesses/${encodeURIComponent(slug)}/info`,
      // A short revalidation window so social crawlers hitting many URLs in
      // a burst share one fetch, while merchant edits show within a minute.
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicBusinessInfo;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const b = await fetchBusinessInfo(slug);
  if (!b) {
    return { title: 'Business not found' };
  }
  const title = b.businessName;
  const about =
    b.aboutText?.trim() ||
    `Menu, address and info for ${b.businessName}. Get your loyalty card too.`;
  const ogImage = b.logoUrl ?? undefined;
  return {
    title,
    description: about,
    openGraph: {
      title: `${title} · Stamposa`,
      description: about,
      type: 'website',
      siteName: 'Stamposa',
      ...(ogImage ? { images: [{ url: ogImage, alt: b.businessName }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: `${title} · Stamposa`,
      description: about,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function BusinessInfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const b = await fetchBusinessInfo(slug);
  if (!b) notFound();

  const accent = b.brandColor && /^#[0-9a-f]{6}$/i.test(b.brandColor) ? b.brandColor : '#4F46E5';

  // Map link: prefer the merchant-supplied googleMapsUrl, else derive one
  // from the address so the button never dead-ends.
  const mapHref = b.googleMapsUrl
    ? b.googleMapsUrl
    : b.addressLine
      ? `https://maps.google.com/?q=${encodeURIComponent(b.addressLine)}`
      : null;

  const hasInfoCard = Boolean(
    b.addressLine || b.hoursText || b.phoneNumber || b.contactEmail || b.websiteUrl,
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#1a1a26] text-white">
      <style>{auroraStyles}</style>
      <AuroraBackdrop />
      <GridPattern />

      {/* Subtle top bar so a visitor arriving from an Instagram bio still
          sees the Stamposa source. Non-intrusive by design. */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-8">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
          Stamposa
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-16 pt-8 sm:pt-12">
        {/* Hero — logo + name + brand-colour accent stripe. */}
        <section className="flex flex-col items-center text-center">
          <LogoAvatar
            name={b.businessName}
            logoUrl={b.logoUrl}
            size="xl"
            className="shadow-[0_20px_60px_-10px_rgba(15,12,30,0.9)]"
          />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {b.businessName}
          </h1>
          <p
            aria-hidden
            className="mt-3 h-1 w-16 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-white/50">
            About us
          </p>
        </section>

        {/* About panel — only when there's something to say. */}
        {b.aboutText?.trim() && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-white/80">
              {b.aboutText}
            </p>
          </section>
        )}

        {/* Address / hours / contact — hidden entirely if nothing set. */}
        {hasInfoCard && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {b.addressLine && (
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    <MapPin className="size-3.5" /> Address
                  </dt>
                  <dd className="text-sm leading-relaxed text-white/85">{b.addressLine}</dd>
                  {mapHref && (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-amber-300 hover:text-amber-200"
                    >
                      Open in Maps <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              )}

              {b.hoursText && (
                <div className="space-y-1">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    Hours
                  </dt>
                  <dd className="whitespace-pre-line text-sm leading-relaxed text-white/85">
                    {b.hoursText}
                  </dd>
                </div>
              )}

              {b.phoneNumber && (
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    <Phone className="size-3.5" /> Phone
                  </dt>
                  <dd>
                    <a
                      href={`tel:${b.phoneNumber.replace(/\s+/g, '')}`}
                      className="text-sm font-medium text-white/85 hover:text-white"
                    >
                      {b.phoneNumber}
                    </a>
                  </dd>
                </div>
              )}

              {b.contactEmail && (
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    <Mail className="size-3.5" /> Email
                  </dt>
                  <dd>
                    <a
                      href={`mailto:${b.contactEmail}`}
                      className="break-all text-sm font-medium text-white/85 hover:text-white"
                    >
                      {b.contactEmail}
                    </a>
                  </dd>
                </div>
              )}

              {b.websiteUrl && (
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    Website
                  </dt>
                  <dd>
                    <a
                      href={b.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-sm font-medium text-white/85 hover:text-white"
                    >
                      {b.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      <ExternalLink className="size-3" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* CTAs — menu (if set) then the loyalty card. */}
        <div className="space-y-3 pt-2">
          {b.menuUrl && (
            <a
              href={b.menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white shadow-[0_20px_50px_-10px_rgba(15,12,30,0.8)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)`,
              }}
            >
              <Menu className="size-5" /> View our menu
              <ExternalLink className="size-4 opacity-80" />
            </a>
          )}
          <Link
            href={`/join/${b.slug}`}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] text-sm font-medium text-white/85 backdrop-blur-2xl transition-colors hover:bg-white/[0.1]"
          >
            <Sparkles className="size-4 text-amber-300" /> Get your loyalty card
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          Powered by <span className="font-medium text-white/60">Stamposa</span>
        </p>
      </main>
    </div>
  );
}
