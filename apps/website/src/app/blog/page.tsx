import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';

import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { formatPostDate, getAllPosts, type Post } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Product updates and the thinking behind Stamposa: how the counter console, the stamp ledger, wallet passes and analytics were built.',
  alternates: { canonical: '/blog', types: { 'application/rss+xml': '/blog/feed.xml' } },
  openGraph: {
    title: 'Stamposa blog',
    description: 'Product updates and the thinking behind Stamposa.',
    url: 'https://stamposa.com/blog',
    type: 'website',
  },
};

function CategoryTag({ category }: { category: Post['category'] }) {
  return (
    <span className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase dark:text-brand-300">
      {category}
    </span>
  );
}

function Meta({ post }: { post: Post }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
      <time dateTime={post.date}>{formatPostDate(post.date)}</time>
      <span aria-hidden>·</span>
      <span>{post.readingMinutes} min read</span>
    </p>
  );
}

/** The newest post, shown large with its cover. */
function FeaturedPost({ post }: { post: Post }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid gap-8 rounded-3xl border border-line/80 bg-paper-tint p-6 transition-colors hover:border-brand-300 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center dark:hover:border-brand-500/40"
    >
      <div>
        <div className="flex items-center gap-3">
          <CategoryTag category={post.category} />
          <span className="rounded-full bg-brand-600 px-2 py-0.5 font-brand-mono text-[10px] tracking-widest text-white uppercase">
            Latest
          </span>
        </div>
        <h2 className="mt-3 font-display text-[1.9rem] leading-[1.12] font-semibold tracking-tight text-strong group-hover:text-brand-700 sm:text-[2.3rem] dark:group-hover:text-brand-200">
          {post.title}
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-body">{post.excerpt}</p>
        <div className="mt-6 flex items-center justify-between gap-4">
          <Meta post={post} />
          <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-brand-600 dark:text-brand-300">
            Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
      {post.cover && (
        <div className="flex justify-center lg:justify-end">
          {post.cover.phone ? (
            <div className="w-[210px] overflow-hidden rounded-[2rem] border-[7px] border-ink bg-ink shadow-2xl shadow-ink/25">
              <Image
                src={post.cover.src}
                alt={post.cover.alt}
                width={390}
                height={844}
                sizes="210px"
                className="w-full rounded-[1.5rem]"
                priority
              />
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-2xl border border-line shadow-2xl shadow-ink/10">
              <Image
                src={post.cover.src}
                alt={post.cover.alt}
                width={1440}
                height={900}
                sizes="(max-width: 1024px) 100vw, 480px"
                className="w-full"
                priority
              />
            </div>
          )}
        </div>
      )}
    </Link>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl border border-line/80 bg-surface p-6 transition-colors hover:border-brand-300 dark:hover:border-brand-500/40"
    >
      <CategoryTag category={post.category} />
      <h3 className="mt-2.5 font-display text-[1.25rem] leading-snug font-semibold tracking-tight text-strong group-hover:text-brand-700 dark:group-hover:text-brand-200">
        {post.title}
      </h3>
      <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-body">{post.excerpt}</p>
      <div className="mt-5">
        <Meta post={post} />
      </div>
    </Link>
  );
}

export default function BlogIndexPage() {
  const [latest, ...rest] = getAllPosts();

  return (
    <div className="min-h-dvh bg-surface text-strong">
      <SiteHeader active="blog" />

      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-10 sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 font-brand-mono text-[11px] tracking-widest text-brand-700 uppercase dark:bg-brand-500/15 dark:text-brand-200">
          <Newspaper className="size-3" aria-hidden /> Blog
        </span>
        <h1 className="mt-5 max-w-3xl font-display text-[2.5rem] leading-[1.05] font-semibold tracking-tight text-strong sm:text-[3.25rem]">
          What we built, and why
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-body">
          Product updates and the thinking behind them. Short, specific, and written by the people
          who made the decisions.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 sm:pb-24">
        {latest && <FeaturedPost post={latest} />}

        {rest.length > 0 && (
          <>
            <p className="mt-14 mb-6 flex items-center gap-3 font-brand-mono text-[11px] font-semibold tracking-widest text-muted uppercase">
              Earlier
              <span className="h-px flex-1 bg-line" />
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
