import type { Metadata } from 'next';

import { LegalReviewBanner } from '@/components/marketing/legal-review-banner';
import { Prose } from '@/components/marketing/prose';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Stamposa collects, uses and protects personal data — merchant accounts, staff accounts, and the customers who join a loyalty program.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPolicy() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-strong">
          Privacy Policy
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          Effective date: <strong>[LEGAL REVIEW — insert date]</strong> · Governed by the laws of
          India.
        </p>
        <div className="mt-8">
          <LegalReviewBanner />
        </div>
        <Prose>
          <h2>Who we are</h2>
          <p>
            Stamposa is operated by <strong>[LEGAL REVIEW — legal entity name, CIN, registered
            office address]</strong> (&ldquo;<strong>Stamposa</strong>&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;). We are a data fiduciary under India&rsquo;s Digital Personal Data
            Protection Act, 2023 (&ldquo;DPDP Act&rdquo;) for the accounts we operate directly
            (merchant, staff and platform admin accounts). For the customer data a merchant
            collects using Stamposa, we act as a data processor on that merchant&rsquo;s behalf
            &mdash; see our Data Processing Agreement.
          </p>

          <h2>What we collect</h2>
          <p>
            <strong>Merchant &amp; staff accounts.</strong> Name, email address, phone number,
            password hash, business profile (name, address, phone, logo). We also record the IP
            address and user agent of sessions for security.
          </p>
          <p>
            <strong>Customer accounts (a merchant&rsquo;s customers).</strong> Phone number,
            optional name and email, marketing consent flag, and the merchant&rsquo;s private
            notes / tags on that customer. Every stamp added, every reward redeemed, and every
            campaign message sent is recorded so the merchant has an accurate history.
          </p>
          <p>
            <strong>Payments.</strong> We do not store card details. Payments are processed by
            our merchant of record, Dodo Payments, which sees the card details directly.
          </p>
          <p>
            <strong>Technical.</strong> We use Sentry to record application errors (with the
            request id and, where relevant, the internal account id &mdash; never a phone number
            or email).
          </p>

          <h2>Why we collect it</h2>
          <ul>
            <li>To operate the loyalty program the merchant has configured.</li>
            <li>To authenticate you, and to protect your account against fraud.</li>
            <li>To send transactional messages (OTP codes, email verification).</li>
            <li>
              To send marketing/campaign messages ONLY when you have consented (customer) or on
              behalf of a merchant to their own opted-in customers.
            </li>
            <li>To provide analytics to the merchant about their own customer base.</li>
            <li>To meet our tax, accounting and legal obligations.</li>
          </ul>

          <h2>How long we keep it</h2>
          <p>
            Merchant accounts and their customer data: for as long as the account is active,
            plus <strong>[LEGAL REVIEW — retention period, typical 12&ndash;24 months]</strong>{' '}
            after cancellation to satisfy tax and accounting rules. You can request earlier
            deletion (see &ldquo;Your rights&rdquo; below).
          </p>
          <p>
            Application logs and Sentry error records: 90 days. Backups: rotated according to our
            deploy runbook (daily 7 days, weekly 4 weeks, monthly 12 months).
          </p>

          <h2>Who we share it with</h2>
          <p>
            We share the minimum data needed with our sub-processors:
          </p>
          <ul>
            <li><strong>Dodo Payments</strong> &mdash; merchant billing (invoice email, plan).</li>
            <li><strong>MSG91</strong> &mdash; SMS delivery (phone number, message body).</li>
            <li>
              <strong>Apple Wallet</strong> and <strong>Google Wallet</strong> &mdash; pass
              rendering (membership id, business name, stamp count).
            </li>
            <li><strong>Sentry</strong> &mdash; error monitoring (technical metadata only).</li>
            <li>
              Our <strong>infrastructure provider</strong>{' '}
              <strong>[LEGAL REVIEW &mdash; CloudStick / hosting provider legal name]</strong>{' '}
              stores our databases.
            </li>
          </ul>
          <p>
            We do not sell personal data. We do not share personal data with advertisers.
          </p>

          <h2>Where the data is stored</h2>
          <p>
            Our production database is hosted in <strong>[LEGAL REVIEW &mdash; region, e.g. India
            (Mumbai)]</strong>. Some sub-processors process data outside India; where they do, we
            rely on the DPDP Act&rsquo;s cross-border transfer rules and standard contractual
            terms.
          </p>

          <h2>Your rights</h2>
          <p>Under the DPDP Act you have the right to:</p>
          <ul>
            <li>Ask what personal data we hold about you.</li>
            <li>Ask us to correct or update it.</li>
            <li>
              Ask us to erase it (subject to any legal retention we still owe &mdash; e.g. tax
              records).
            </li>
            <li>Withdraw consent for marketing messages at any time.</li>
            <li>
              Nominate someone to exercise these rights on your behalf if you are unable to.
            </li>
            <li>Complain to the Data Protection Board of India.</li>
          </ul>
          <p>
            To exercise any of these, email <strong>[LEGAL REVIEW &mdash; privacy contact email,
            e.g. privacy@stamposa.com]</strong>. Merchants can also self-serve erasure of their
            customers from the merchant dashboard.
          </p>

          <h2>Security</h2>
          <p>
            We use argon2 password hashing, TLS everywhere, per-tenant data isolation, JWT
            sessions with server-side revocation, Redis-backed rate limiting on sensitive
            endpoints, and encrypted off-box daily database backups. Platform administrators are
            required to use two-factor authentication.
          </p>

          <h2>Children</h2>
          <p>
            Stamposa is not directed at children under 18. Merchants are contractually required
            not to enrol minors into their loyalty programs without verifiable parental consent.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            When we make material changes we will email account holders and update the effective
            date above. Continuing to use Stamposa after the effective date means you accept the
            change.
          </p>

          <h2>Contact</h2>
          <p>
            <strong>[LEGAL REVIEW &mdash; grievance officer name and contact per the DPDP Act +
            IT Rules 2011]</strong>
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
