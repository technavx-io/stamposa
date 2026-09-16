import type { Metadata } from 'next';

import { LegalReviewBanner } from '@/components/marketing/legal-review-banner';
import { Prose } from '@/components/marketing/prose';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'The small set of cookies and browser storage Stamposa uses across the marketing site and the app.',
  alternates: { canonical: '/legal/cookies' },
};

export default function CookiePolicy() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-14">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-strong">
          Cookie Policy
        </h1>
        <p className="mt-3 text-[13px] text-muted">
          Effective date: <strong>[LEGAL REVIEW &mdash; insert date]</strong>
        </p>
        <div className="mt-8">
          <LegalReviewBanner />
        </div>
        <Prose>
          <h2>What we mean by &ldquo;cookies&rdquo;</h2>
          <p>
            Cookies are small pieces of data a website stores in your browser. This policy also
            covers <code>localStorage</code>, <code>sessionStorage</code> and IndexedDB &mdash;
            all of which are functionally similar for privacy purposes.
          </p>

          <h2>What we use</h2>
          <p>
            Stamposa uses only what is necessary to run the service. We do NOT set any analytics
            or advertising trackers.
          </p>

          <h3>Marketing site (stamposa.com)</h3>
          <p>
            The marketing site uses <strong>no cookies</strong> and stores a single theme
            preference (<code>light</code> / <code>dark</code>) in <code>localStorage</code> so
            the site keeps the theme you chose. That preference stays in your browser and is
            never sent to us.
          </p>

          <h3>App (app.stamposa.com)</h3>
          <ul>
            <li>
              <strong>Session tokens</strong> &mdash; stored in <code>localStorage</code> under
              the keys <code>loyalty.session.merchant</code>, <code>loyalty.session.staff</code>{' '}
              and <code>loyalty.session.customer</code>. Contain a short-lived access token (15
              minutes) and a refresh token (30 days). Required to keep you signed in. We are
              moving these to HTTP-only cookies for stronger XSS protection; when we do, this
              section will be updated.
            </li>
            <li>
              <strong>Theme preference</strong> &mdash; same as on the marketing site.
            </li>
            <li>
              <strong>Draft state</strong> &mdash; some forms keep an unsent draft in{' '}
              <code>sessionStorage</code> so a refresh does not lose your work; it is cleared
              when the tab closes.
            </li>
          </ul>

          <h3>API (api.stamposa.com)</h3>
          <p>
            The API sets no cookies today. Bearer tokens travel in the{' '}
            <code>Authorization</code> header of each request.
          </p>

          <h2>Third-party cookies</h2>
          <p>
            <strong>None</strong> on the marketing site or the app. Wallet passes (Apple / Google
            Wallet) are installed to the phone&rsquo;s wallet app, not to your browser.{' '}
            <strong>Dodo Payments</strong>, our billing provider, may set its own cookies during
            checkout; that happens on Dodo&rsquo;s domain and is governed by their privacy
            policy.
          </p>

          <h2>How to opt out</h2>
          <p>
            Because we only use what is strictly necessary, there is no consent banner. If you
            want to clear the local session, sign out from the app or clear site data from your
            browser settings &mdash; you will simply need to sign in again.
          </p>

          <h2>Changes</h2>
          <p>
            If we add any category of storage beyond what is listed above (analytics, ads or
            similar) we will publish a consent banner and update this page.
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
