import type { Metadata } from 'next';

import { LegalReviewBanner } from '@/components/marketing/legal-review-banner';
import { Prose } from '@/components/marketing/prose';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'How cancellations, downgrades and refunds work on Stamposa monthly and annual plans.',
  alternates: { canonical: '/legal/refunds' },
};

export default function RefundPolicy() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-strong">
          Refund Policy
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          Effective date: <strong>[LEGAL REVIEW &mdash; insert date]</strong>
        </p>
        <div className="mt-8">
          <LegalReviewBanner />
        </div>
        <Prose>
          <h2>Summary</h2>
          <ul>
            <li>
              <strong>Monthly plans:</strong> cancel anytime, no refund for the remainder of the
              current billing period. Service runs to the end of the paid period.
            </li>
            <li>
              <strong>Annual plans:</strong> pro-rated refund of unused months if you cancel
              within the first 30 days of a fresh annual purchase. After 30 days, no refund; the
              service continues to the end of the paid year.
            </li>
            <li><strong>SMS / WhatsApp credits:</strong> non-refundable once purchased.</li>
            <li><strong>Add-on storage / extra staff seats:</strong> non-refundable.</li>
          </ul>

          <h2>How to cancel</h2>
          <p>
            Cancel from the merchant dashboard under <em>Billing</em>, or email{' '}
            <strong>[LEGAL REVIEW &mdash; support email, e.g. support@stamposa.com]</strong>. The
            service continues until the end of the paid period; we do not backdate cancellations.
          </p>

          <h2>How to request a refund</h2>
          <p>
            Email <strong>[LEGAL REVIEW &mdash; billing email]</strong> from the address
            registered on the account, with your invoice number and the reason. We reply within{' '}
            <strong>[LEGAL REVIEW &mdash; typical 5 business days]</strong>. Approved refunds are
            processed by our merchant of record, <strong>Dodo Payments</strong>, back to the
            original payment method within 7&ndash;14 business days depending on your bank.
          </p>

          <h2>Downgrades</h2>
          <p>
            You can move to a smaller plan at any time. The price change takes effect at the
            start of the next billing period; we do not refund the difference for the current
            period.
          </p>

          <h2>Chargebacks</h2>
          <p>
            Please email us before initiating a chargeback &mdash; most billing questions are
            resolved faster that way. A chargeback filed without contacting us may result in
            immediate suspension of the account pending resolution.
          </p>

          <h2>Statutory rights</h2>
          <p>
            Nothing in this policy limits any refund right you may have under applicable
            consumer-protection law. If a specific statute conflicts with this policy, the
            statute wins for that specific claim.
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
