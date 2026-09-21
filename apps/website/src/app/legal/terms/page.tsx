import type { Metadata } from 'next';

import { LegalReviewBanner } from '@/components/marketing/legal-review-banner';
import { Prose } from '@/components/marketing/prose';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The contract between Stamposa and each merchant using the platform: what you can do, what we do, plans, liability and termination.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsOfService() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-strong">
          Terms of Service
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          Effective date: <strong>2026-09-21</strong> · Governed by the
          laws of India.
        </p>
        <div className="mt-8">
          <LegalReviewBanner />
        </div>
        <Prose>
          <h2>1. Who these terms bind</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement between you
            (the merchant that signs up, &ldquo;<strong>you</strong>&rdquo;) and{' '}
            <strong>[LEGAL REVIEW &mdash; legal entity name, CIN]</strong> (&ldquo;
            <strong>Stamposa</strong>&rdquo;, &ldquo;we&rdquo;). By creating an account or using
            the service you accept these Terms. If you accept them on behalf of a business, you
            warrant you have the authority to do so.
          </p>

          <h2>2. The service</h2>
          <p>
            Stamposa provides a hosted digital loyalty platform: a merchant dashboard, a staff
            scanner, a customer wallet card (Apple / Google Wallet + PWA), an append-only stamp
            ledger, campaign messaging via SMS and email, and analytics. Availability targets
            and support windows are described on our pricing page and any order form.
          </p>

          <h2>3. Your account</h2>
          <p>
            Keep your login credentials secret. Every action taken through your account is
            attributed to you. Tell us immediately at{' '}
            <strong>hello@stamposa.com</strong> if you suspect unauthorised
            access. You are responsible for what your staff members do under staff accounts you
            create.
          </p>

          <h2>4. Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Enrol customers into your loyalty program without a lawful basis to hold and use
              their contact details.
            </li>
            <li>Send marketing messages to customers who have not consented.</li>
            <li>Ignore India&rsquo;s TRAI DLT or the DPDP Act consent rules.</li>
            <li>
              Attempt to reverse-engineer, resell, or provide the service to a third party as a
              stand-alone loyalty product.
            </li>
            <li>Upload content that infringes intellectual property or is unlawful.</li>
            <li>
              Circumvent rate limits, probe the platform for vulnerabilities without written
              permission, or run automated scraping.
            </li>
          </ul>

          <h2>5. Fees and billing</h2>
          <p>
            Subscription plans and add-ons (SMS credits, WhatsApp credits, storage) are listed on
            our pricing page. Fees are collected in INR (or USD, at your option) by our merchant
            of record, <strong>Dodo Payments</strong>, who issues the invoice, collects
            applicable GST/VAT, and remits it. Fees are billed in advance, monthly or annually
            depending on the plan you choose. Refunds are governed by our Refund Policy.
          </p>
          <p>
            We may change list prices with 30 days&rsquo; email notice. Any price change takes
            effect at the start of your next billing period.
          </p>

          <h2>6. Data ownership</h2>
          <p>
            You own the customer data you collect through Stamposa. We are the processor of that
            data on your behalf &mdash; the Data Processing Agreement governs how we handle it.
            We own the platform itself, its code, brand and documentation.
          </p>

          <h2>7. Confidentiality</h2>
          <p>
            Each party must keep the other&rsquo;s non-public information confidential and use
            it only to perform the contract. This survives termination for{' '}
            <strong>[LEGAL REVIEW &mdash; typical 3 years]</strong>.
          </p>

          <h2>8. Suspension and termination</h2>
          <p>
            You may cancel at any time from the billing screen; the service continues until the
            end of the billing period. We may suspend or terminate your account with notice if
            you materially breach these Terms (for example, using Stamposa for spam), and
            without notice for illegal use, non-payment beyond{' '}
            <strong>[LEGAL REVIEW &mdash; typical 30 days]</strong>, or a compromise that
            threatens other tenants.
          </p>
          <p>
            On termination we will make your data available for export for{' '}
            <strong>[LEGAL REVIEW &mdash; typical 30 days]</strong> and then delete it, subject
            to any legal retention we still owe (see the Privacy Policy).
          </p>

          <h2>9. Warranties &amp; disclaimers</h2>
          <p>
            We provide the service &ldquo;as is&rdquo; and do not warrant that it will be
            uninterrupted or error-free. We do not warrant that any specific messaging carrier
            will deliver a particular message. To the maximum extent permitted by law we
            disclaim all implied warranties.
          </p>

          <h2>10. Limitation of liability</h2>
          <p>
            To the extent permitted by law, our aggregate liability under these Terms is capped
            at the fees you paid us in the 12 months preceding the claim. Neither party is
            liable for indirect, incidental, consequential or lost-profit damages. Nothing in
            these Terms limits either party&rsquo;s liability for gross negligence, wilful
            misconduct, death or personal injury, or breach of confidentiality.
          </p>

          <h2>11. Indemnity</h2>
          <p>
            You will defend and indemnify us against third-party claims arising from (a) your
            breach of these Terms, (b) your use of the service to send unlawful messages, or
            (c) your customer data infringing another party&rsquo;s rights.
          </p>

          <h2>12. Force majeure</h2>
          <p>
            Neither party is liable for delay or failure caused by events beyond reasonable
            control &mdash; e.g. a major carrier outage, government action, natural disaster.
          </p>

          <h2>13. Governing law and disputes</h2>
          <p>
            These Terms are governed by the laws of India. The courts at{' '}
            <strong>[LEGAL REVIEW &mdash; seat, e.g. Bengaluru]</strong> have exclusive
            jurisdiction, except that either party may seek urgent injunctive relief in any
            competent court.
          </p>

          <h2>14. Changes</h2>
          <p>
            We may update these Terms; material changes will be emailed to the account owner
            with at least 30 days&rsquo; notice. Continued use after the effective date means
            acceptance.
          </p>

          <h2>15. Notices</h2>
          <p>
            Notices to us: <strong>[LEGAL REVIEW &mdash; legal notice email + postal
            address]</strong>. Notices to you: the email on your account.
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
