import type { ReactNode } from 'react';
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
    : b.address
      ? `https://maps.google.com/?q=${encodeURIComponent(b.address)}`
      : null;

  const hasInfoCard = Boolean(
    b.address || b.hoursText || b.phone || b.contactEmail || b.websiteUrl,
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
              {b.address && (
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    <MapPin className="size-3.5" /> Address
                  </dt>
                  <dd className="text-sm leading-relaxed text-white/85">{b.address}</dd>
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

              {b.phone && (
                <div className="space-y-1">
                  <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                    <Phone className="size-3.5" /> Phone
                  </dt>
                  <dd>
                    <a
                      href={`tel:${b.phone.replace(/\s+/g, '')}`}
                      className="text-sm font-medium text-white/85 hover:text-white"
                    >
                      {b.phone}
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

        {/* Follow us — icon row for the platforms the merchant filled in.
            Entire section hides when nothing is set, so it never dangles. */}
        <SocialLinks b={b} />

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

// ── Social links ────────────────────────────────────────────────────────
// A horizontal row of 44×44 rounded buttons, one per platform the merchant
// filled in. Missing platforms drop out; when none are set, the whole
// section (heading included) hides so there is no dangling "Follow us".
//
// lucide-react in this repo does not ship brand icons (they were removed
// upstream over trademark concerns), so every glyph below is inlined SVG.
// currentColor lets the parent button drive the tint through the same
// white/85 → white ramp the rest of the page uses.

type SocialIconProps = { className?: string };

function InstagramIcon({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.5 22v-8h2.7l.4-3.13H13.5V8.87c0-.9.25-1.52 1.55-1.52h1.65V4.55c-.29-.04-1.27-.13-2.4-.13-2.38 0-4 1.45-4 4.12v2.33H7.6V14h2.7v8h3.2z" />
    </svg>
  );
}

function YoutubeIcon({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.54 3.55 12 3.55 12 3.55s-7.54 0-9.39.53A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12C4.46 20.45 12 20.45 12 20.45s7.54 0 9.39-.53a3 3 0 0 0 2.11-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.75 15.57V8.43L15.82 12l-6.07 3.57z" />
    </svg>
  );
}

function XIcon({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.834L1.254 2.25h6.83l4.713 6.231 5.447-6.231zm-1.161 17.52h1.833L7.084 4.126H5.116l11.967 15.644z" />
    </svg>
  );
}

function LinkedinIcon({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/**
 * TikTok isn't in lucide-react — inline the brand mark so we don't pull in
 * a whole icon package for two glyphs. currentColor lets the parent button
 * drive the tint through the same white/85 → white ramp as lucide icons.
 */
function TikTokIcon({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.66a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.09z" />
    </svg>
  );
}

/** WhatsApp — same rationale as TikTok. Sized to match lucide's size-5. */
function WhatsAppIcon({ className }: SocialIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
    </svg>
  );
}

function SocialLinks({ b }: { b: PublicBusinessInfo }) {
  const links: Array<{
    label: string;
    href: string;
    icon: ReactNode;
  }> = [];
  if (b.instagramUrl) {
    links.push({
      label: 'Instagram',
      href: b.instagramUrl,
      icon: <InstagramIcon className="size-5" />,
    });
  }
  if (b.facebookUrl) {
    links.push({
      label: 'Facebook',
      href: b.facebookUrl,
      icon: <FacebookIcon className="size-5" />,
    });
  }
  if (b.youtubeUrl) {
    links.push({
      label: 'YouTube',
      href: b.youtubeUrl,
      icon: <YoutubeIcon className="size-5" />,
    });
  }
  if (b.xUrl) {
    links.push({
      label: 'X',
      href: b.xUrl,
      icon: <XIcon className="size-5" />,
    });
  }
  if (b.linkedinUrl) {
    links.push({
      label: 'LinkedIn',
      href: b.linkedinUrl,
      icon: <LinkedinIcon className="size-5" />,
    });
  }
  if (b.tiktokUrl) {
    links.push({
      label: 'TikTok',
      href: b.tiktokUrl,
      icon: <TikTokIcon className="size-5" />,
    });
  }
  if (b.whatsappUrl) {
    links.push({
      label: 'WhatsApp',
      href: b.whatsappUrl,
      icon: <WhatsAppIcon className="size-5" />,
    });
  }
  if (links.length === 0) return null;

  return (
    <section className="flex flex-col items-center gap-3 pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
        Follow us
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a26]"
            >
              {link.icon}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
