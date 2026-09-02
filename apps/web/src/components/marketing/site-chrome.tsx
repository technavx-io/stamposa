import Link from 'next/link';
import { BookOpen, Newspaper, Stamp, Store } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggleCompact } from '@/components/ui/theme-toggle';
import { appHref, siteHref } from '@/lib/hosts';

/**
 * The header and footer shared by the informational pages that don't carry
 * their own (currently the blog). The landing page and guide keep their
 * bespoke headers because their in-page anchors differ.
 */

export function SiteHeader({ active }: { active?: 'guide' | 'blog' }) {
  const link = (key: 'guide' | 'blog') =>
    `transition-colors hover:text-strong ${active === key ? 'text-strong font-medium' : ''}`;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
        <Link
          href={siteHref('/')}
          className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-strong"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Stamp className="size-4" />
          </span>
          Stamposa
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] text-body md:flex">
          <Link href={siteHref('/#how')} className="transition-colors hover:text-strong">
            How it works
          </Link>
          <Link href={siteHref('/#included')} className="transition-colors hover:text-strong">
            Features
          </Link>
          <Link href={siteHref('/guide')} className={link('guide')}>
            Guide
          </Link>
          <Link href={siteHref('/blog')} className={link('blog')}>
            Blog
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggleCompact />
          <Link href={appHref('/staff/login')}>
            <Button variant="ghost" size="sm" className="whitespace-nowrap">
              Staff login
            </Button>
          </Link>
          <Link href={appHref('/merchant/login')}>
            <Button variant="brand" size="sm" className="whitespace-nowrap">
              Merchant sign in
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display font-semibold text-strong">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-600 text-white">
              <Stamp className="size-3.5" />
            </span>
            Stamposa
          </p>
          <p className="mt-2 text-[13px] text-muted">
            Digital loyalty cards for cafés, salons and shops.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-body">
          <Link href={siteHref('/guide')} className="transition-colors hover:text-strong">
            <BookOpen className="mr-1.5 inline size-3.5" aria-hidden />
            Guide
          </Link>
          <Link href={siteHref('/blog')} className="transition-colors hover:text-strong">
            <Newspaper className="mr-1.5 inline size-3.5" aria-hidden />
            Blog
          </Link>
          <Link href={appHref('/merchant/login')} className="transition-colors hover:text-strong">
            <Store className="mr-1.5 inline size-3.5" aria-hidden />
            Merchant sign in
          </Link>
          <Link href={appHref('/staff/login')} className="transition-colors hover:text-strong">
            Staff login
          </Link>
          <Link href={appHref('/my-cards')} className="transition-colors hover:text-strong">
            My cards
          </Link>
        </nav>
      </div>
      <div className="border-t border-line/70">
        <p className="mx-auto w-full max-w-6xl px-5 py-5 text-[12.5px] text-muted">
          © {new Date().getFullYear()} Stamposa · stamposa.com
        </p>
      </div>
    </footer>
  );
}
