import type { Metadata } from 'next';

import { LegalReviewBanner } from '@/components/marketing/legal-review-banner';
import { Prose } from '@/components/marketing/prose';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Data Processing Agreement',
  description:
    'How Stamposa (processor) handles the personal data of your customers (data principals) on your behalf (controller) under India’s DPDP Act 2023.',
  alternates: { canonical: '/legal/dpa' },
};

export default function DataProcessingAgreement() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-strong">
          Data Processing Agreement
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          Effective date: <strong>2026-09-21</strong> · Forms part of
          the Stamposa Terms of Service · Governed by the laws of India.
        </p>
        <div className="mt-8">
          <LegalReviewBanner />
        </div>
        <Prose>
          <h2>1. Roles</h2>
          <p>
            You (the merchant) are the <strong>data fiduciary</strong> (controller) for the
            personal data of your customers. Stamposa is the <strong>data processor</strong>{' '}
            acting on your documented instructions. Instructions from you include the choices
            you make in the merchant dashboard (creating campaigns, sending broadcasts,
            configuring wallet passes, exporting data).
          </p>

          <h2>2. Subject matter and scope</h2>
          <ul>
            <li>
              <strong>Subject matter:</strong> operation of a digital loyalty platform on your
              behalf.
            </li>
            <li>
              <strong>Nature and purpose:</strong> enrol customers, record stamps and
              redemptions, deliver campaign messages, provide analytics.
            </li>
            <li>
              <strong>Categories of personal data:</strong> phone number, optional name and
              email, marketing consent flag, loyalty history (stamps, rewards), and any tags or
              notes you record.
            </li>
            <li>
              <strong>Categories of data principals:</strong> your customers, and your staff
              members that you invite to the platform.
            </li>
            <li><strong>Duration:</strong> as long as your account is active with us.</li>
          </ul>

          <h2>3. Our obligations as processor</h2>
          <p>Stamposa will:</p>
          <ul>
            <li>Process personal data only on your documented instructions.</li>
            <li>
              Keep the data confidential and ensure personnel with access are bound by
              confidentiality.
            </li>
            <li>Apply the security measures described in Annex 1.</li>
            <li>
              Assist you (at your reasonable request) in responding to requests from data
              principals to access, correct, port or erase their data.
            </li>
            <li>
              Assist you in demonstrating compliance with the DPDP Act, including responding to
              queries from the Data Protection Board of India.
            </li>
            <li>
              Notify you without undue delay (and in any case within{' '}
              <strong>[LEGAL REVIEW &mdash; typical 72 hours]</strong>) after becoming aware of
              a personal-data breach affecting your data.
            </li>
            <li>
              At your choice, delete or return all personal data at the end of the service and
              delete existing copies unless retention is legally required (see the Privacy
              Policy retention section).
            </li>
          </ul>

          <h2>4. Your obligations as controller</h2>
          <p>
            You warrant that (a) you have a valid basis under the DPDP Act to collect and share
            each customer&rsquo;s data with us, (b) you have obtained the consents required to
            send them marketing messages, and (c) you will respond to their DPDP rights requests
            within the statutory time limits.
          </p>

          <h2>5. Sub-processors</h2>
          <p>
            You authorise us to engage the sub-processors listed in Annex 2 to help deliver the
            service. When we add a new sub-processor we will update the list and give you at
            least <strong>[LEGAL REVIEW &mdash; typical 30 days]</strong> notice by email. If
            you reasonably object, you may terminate the affected service with a pro-rated
            refund of prepaid fees.
          </p>
          <p>
            We remain liable to you for our sub-processors&rsquo; acts and omissions as if they
            were our own.
          </p>

          <h2>6. Cross-border transfers</h2>
          <p>
            Where a sub-processor processes personal data outside India, we rely on the
            transfer rules under the DPDP Act and impose written contractual terms on the
            recipient that provide equivalent protection.
          </p>

          <h2>7. Audits</h2>
          <p>
            On at most one occasion per year, with reasonable notice, you may request an
            independent audit of our processing activities relevant to this DPA at your cost.
            We may satisfy this obligation by providing an up-to-date third-party attestation
            (e.g. SOC 2 or ISO 27001) once we have one.
          </p>

          <h2>8. Liability and precedence</h2>
          <p>
            The liability caps in the Terms of Service apply to this DPA. In case of conflict
            between this DPA and the Terms, this DPA prevails on data-protection matters.
          </p>

          <h2>Annex 1 &mdash; Security measures</h2>
          <ul>
            <li>Argon2 password hashing for all account passwords.</li>
            <li>TLS in transit; unique bind on 127.0.0.1 for internal services.</li>
            <li>Per-tenant data isolation enforced by the application layer.</li>
            <li>JWT access tokens (15 minutes) + rotating refresh tokens (30 days).</li>
            <li>
              Redis-backed rate limiting on authentication, OTP and mutating endpoints;
              idempotency-key middleware for repeated writes.
            </li>
            <li>
              Two-factor authentication required for platform administrators; audit log of every
              admin action, including impersonation sessions.
            </li>
            <li>
              Encrypted daily off-box database backups with 7-daily / 4-weekly / 12-monthly
              rotation; documented restore drill.
            </li>
            <li>Application error monitoring via Sentry, without personal identifiers.</li>
            <li>
              Environment separation: development, staging (kept ephemeral) and production;
              distinct JWT secrets per environment.
            </li>
          </ul>

          <h2>Annex 2 &mdash; Sub-processors</h2>
          <ul>
            <li>
              <strong>Dodo Payments</strong> &mdash; merchant billing (merchant of record).
            </li>
            <li><strong>MSG91</strong> &mdash; SMS delivery (India DLT).</li>
            <li><strong>Apple Wallet + APNs</strong> &mdash; iOS pass rendering and push updates.</li>
            <li><strong>Google Wallet</strong> &mdash; Android pass rendering.</li>
            <li><strong>Sentry</strong> &mdash; application error monitoring.</li>
            <li>
              <strong>Cloudflare R2</strong> &mdash; encrypted off-box backup storage.
            </li>
            <li>
              <strong>[LEGAL REVIEW &mdash; SMTP provider, e.g. Gmail / Postmark]</strong>{' '}
              &mdash; transactional email delivery.
            </li>
            <li>
              <strong>[LEGAL REVIEW &mdash; hosting provider, e.g. CloudStick]</strong> &mdash;
              production infrastructure (VPS hosting Postgres, Redis and application containers).
            </li>
          </ul>

          <h2>Annex 3 &mdash; Contact</h2>
          <p>
            Data protection contact: <strong>[LEGAL REVIEW &mdash; DPO / grievance officer name,
            email, phone]</strong>.
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
