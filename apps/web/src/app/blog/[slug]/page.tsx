import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Prose } from '@/components/marketing/prose';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { Button } from '@/components/ui/button';
import { formatPostDate, getAllPosts, getPost, getRelatedPosts } from '@/lib/blog';
import { appHref } from '@/lib/hosts';

type Params = { slug: string };

/** Every post is known at build time, so the pages are fully static. */
export function generateStaticParams(): Params[] {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://stamposa.com/blog/${post.slug}`,
      type: 'article',
      publishedTime: `${post.date}T00:00:00Z`,
      ...(post.cover ? { images: [{ url: post.cover.src, alt: post.cover.alt }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    url: `https://stamposa.com/blog/${post.slug}`,
    author: { '@type': 'Organization', name: 'Stamposa' },
    publisher: { '@type': 'Organization', name: 'Stamposa', url: 'https://stamposa.com' },
    ...(post.cover ? { image: `https://stamposa.com${post.cover.src}` } : {}),
  };

  return (
    <div className="min-h-dvh bg-surface text-strong">
      <SiteHeader active="blog" />

      <article className="mx-auto w-full max-w-3xl px-5 pt-12 pb-16 sm:pt-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-strong"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> All posts
        </Link>

        <header className="mt-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase dark:text-brand-300">
              {post.category}
            </span>
            <span className="text-[13px] text-muted">
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              <span aria-hidden> · </span>
              {post.readingMinutes} min read
            </span>
          </p>
          <h1 className="mt-4 font-display text-[2.2rem] leading-[1.08] font-semibold tracking-tight text-strong sm:text-[2.75rem]">
            {post.title}
          </h1>
          <p className="mt-5 text-[18px] leading-relaxed text-body">{post.excerpt}</p>
        </header>

        <hr className="my-10 border-line" />

        <Prose>
          <post.Body />
        </Prose>

        <div className="mt-14 rounded-3xl bg-ink px-6 py-10 text-center sm:px-10">
          <p className="font-display text-2xl font-semibold tracking-tight text-white">
            Try it with your own card
          </p>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/65">
            Set up your program, print the QR, and stamp your first customer today.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href={appHref('/merchant/login')}>
              <Button variant="brand" size="lg" className="rounded-xl">
                Start your program <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/guide">
              <Button
                size="lg"
                className="rounded-xl border border-white/25 bg-transparent text-white hover:bg-white/10"
              >
                Read the guide
              </Button>
            </Link>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-line/70 bg-paper-tint">
          <div className="mx-auto w-full max-w-6xl px-5 py-14">
            <p className="flex items-center gap-3 font-brand-mono text-[11px] font-semibold tracking-widest text-muted uppercase">
              More from the blog
              <span className="h-px flex-1 bg-line" />
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group rounded-2xl border border-line/80 bg-surface p-5 transition-colors hover:border-brand-300 dark:hover:border-brand-500/40"
                >
                  <span className="font-brand-mono text-[11px] tracking-widest text-brand-600 uppercase dark:text-brand-300">
                    {p.category}
                  </span>
                  <p className="mt-2 font-display text-[1.05rem] leading-snug font-semibold text-strong group-hover:text-brand-700 dark:group-hover:text-brand-200">
                    {p.title}
                  </p>
                  <p className="mt-3 text-[12.5px] text-muted">
                    <time dateTime={p.date}>{formatPostDate(p.date)}</time> · {p.readingMinutes} min
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
