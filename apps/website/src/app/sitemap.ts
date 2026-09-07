import type { MetadataRoute } from 'next';

import { getAllPosts } from '@/lib/blog';

const SITE = 'https://stamposa.com';

/**
 * Only the informational pages are listed: the app host's pages are
 * behind sign-in or specific to one customer and should not be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const newest = posts[0]?.date;

  return [
    { url: `${SITE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/guide`, changeFrequency: 'monthly', priority: 0.8 },
    {
      url: `${SITE}/blog`,
      changeFrequency: 'weekly',
      priority: 0.7,
      ...(newest ? { lastModified: new Date(`${newest}T00:00:00Z`) } : {}),
    },
    ...posts.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: new Date(`${p.date}T00:00:00Z`),
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
  ];
}
