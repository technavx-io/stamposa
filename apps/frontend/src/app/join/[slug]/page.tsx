import type { Metadata } from 'next';
import { API_URL } from '@/lib/api/client';
import type { PublicBusiness } from '@/lib/api/types';
import { JoinFlow } from './join-flow';

/**
 * Fetch the business server-side so social previews on WhatsApp / Instagram /
 * SMS shares show the merchant's name and reward instead of the generic
 * "Merchant, staff and customer portals for Stamposa" root description
 * (Bug #B5). Runs at request time; a fetch failure quietly falls back to a
 * Stamposa-branded default (never crashes the page).
 */
async function fetchBusiness(slug: string): Promise<PublicBusiness | null> {
  try {
    const res = await fetch(`${API_URL}/v1/public/businesses/${encodeURIComponent(slug)}`, {
      // Cache for a short window so social crawlers hitting many join URLs in
      // a burst don't hammer the API, but a merchant editing their name still
      // sees the update within a minute.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicBusiness;
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
  const b = await fetchBusiness(slug);

  if (!b) {
    return {
      title: 'Join loyalty program',
      description: 'Digital stamp cards and rewards from your favourite local shops.',
    };
  }

  const title = `Join ${b.name}`;
  const description = b.campaign
    ? `Collect ${b.campaign.stampsRequired} stamps → ${b.campaign.reward} at ${b.name}.`
    : `Get your digital loyalty card for ${b.name}.`;

  const ogImage = b.logoUrl ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title: `${title} · Stamposa`,
      description,
      type: 'website',
      siteName: 'Stamposa',
      ...(ogImage ? { images: [{ url: ogImage, alt: b.name }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: `${title} · Stamposa`,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <JoinFlow slug={slug} />;
}
