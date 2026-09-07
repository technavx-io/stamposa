import { posts, type Post, type PostCategory } from '@/content/posts';

export type { Post, PostCategory };

/** Every post, newest first. */
export function getAllPosts(): Post[] {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

/** Posts to suggest under an article: the newest ones that aren't it. */
export function getRelatedPosts(slug: string, limit = 3): Post[] {
  return getAllPosts()
    .filter((p) => p.slug !== slug)
    .slice(0, limit);
}

/** "2 Sept 2026" — matches the rest of the site's date style. */
export function formatPostDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
