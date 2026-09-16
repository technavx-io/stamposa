import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';

import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Legal',
  description:
    'Stamposa legal documents — Privacy Policy, Terms of Service, Refund Policy, Cookie Policy and Data Processing Agreement.',
  alternates: { canonical: '/legal' },
};

const DOCS: Array<{ href: string; title: string; summary: string }> = [
  {
    href: '/legal/privacy',
    title: 'Privacy Policy',
    summary: 'What we collect, why, how long we keep it, and your rights under India’s DPDP Act.',
  },
  {
    href: '/legal/terms',
    title: 'Terms of Service',
    summary: 'The contract between Stamposa and each merchant using the platform.',
  },
  {
    href: '/legal/refunds',
    title: 'Refund Policy',
    summary: 'How cancellations, downgrades and refunds work across our plans.',
  },
  {
    href: '/legal/cookies',
    title: 'Cookie Policy',
    summary: 'The small set of cookies and browser storage the app uses.',
  },
  {
    href: '/legal/dpa',
    title: 'Data Processing Agreement',
    summary: 'For merchants — how Stamposa processes the personal data of your customers on your behalf.',
  },
];

export default function LegalIndex() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-strong">Legal</h1>
        <p className="mt-3 text-body">
          The documents below govern your use of Stamposa. If anything here contradicts a signed
          agreement between us and your business, the signed agreement wins.
        </p>
        <ul className="mt-10 space-y-3">
          {DOCS.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                className="block rounded-lg border border-line/80 p-4 transition-colors hover:border-brand-400 hover:bg-surface-2"
              >
                <div className="flex items-center gap-3">
                  <FileText className="size-4 text-brand-600" aria-hidden />
                  <span className="font-display font-semibold text-strong">{doc.title}</span>
                </div>
                <p className="mt-1 pl-7 text-[14px] text-body">{doc.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
