'use client';

import Link from 'next/link';
import { PHONE_AUTH_ENABLED } from '@/lib/features';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, Gift, MapPin, Stamp } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { customerApi, publicApi } from '@/lib/api/endpoints';
import { customerSession } from '@/lib/auth/session';
import { useStoredSession } from '@/lib/auth/use-stored-session';
import { OtpLogin } from '@/components/auth/otp-login';
import { Button } from '@stamposa/ui/components/button';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { EmptyState, PageLoader } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';
import { AuroraBackdrop, GridPattern, auroraStyles } from '@/components/auth/aurora-visuals';

import { siteHref } from '@stamposa/ui/lib/hosts';

export function JoinFlow({ slug }: { slug: string }) {
  const router = useRouter();
  const { session, ready } = useStoredSession('CUSTOMER');
  const [switching, setSwitching] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const business = useQuery({
    queryKey: ['public', 'business', slug],
    queryFn: () => publicApi.business(slug),
    retry: false,
  });

  const join = useMutation({
    mutationFn: () => customerApi.join(slug, marketingConsent),
    onSuccess: (result) => {
      if (result.alreadyMember) {
        toast.info('You already have this card — here it is.');
      } else {
        toast.success('Welcome aboard! Here is your card.');
      }
      router.replace(`/card/${result.card.id}`);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Could not join. Please try again.');
    },
  });

  if (business.isPending || !ready) return <PageLoader />;

  if (business.isError || !business.data) {
    return (
      <JoinShell>
        <section className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl">
            <EmptyState
              title="Business not found"
              description="This join link doesn't exist. Double-check the QR code or ask the business for a new one."
              action={
                <Link
                  href={siteHref('/')}
                  className="text-sm font-medium text-amber-300 hover:text-amber-200"
                >
                  Go home
                </Link>
              }
            />
          </div>
        </section>
      </JoinShell>
    );
  }

  const b = business.data;

  return (
    <JoinShell>
      <section className="w-full max-w-md space-y-5">
        {/* Business identity — big logo + name + address, all centered. */}
        <div className="flex flex-col items-center text-center text-white">
          <LogoAvatar
            name={b.name}
            logoUrl={b.logoUrl}
            size="xl"
            className="shadow-[0_20px_60px_-10px_rgba(15,12,30,0.9)]"
          />
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white">
            {b.name}
          </h1>
          {b.address && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/60">
              <MapPin className="size-3.5" /> {b.address}
            </p>
          )}
        </div>

        {/* Campaign preview — glass card with the stamp grid + reward line. */}
        {b.campaign && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-white/80">
              <Stamp className="size-4 text-amber-300" /> {b.campaign.name}
            </p>
            <div className="my-4 flex justify-center">
              <StampGrid
                total={b.campaign.stampsRequired}
                filled={0}
                size="sm"
                tone="dark"
                stampIcon={b.style.stampIcon}
                rewardIcon={b.style.rewardIcon}
              />
            </div>
            <p className="flex items-center justify-center gap-1.5 text-sm text-amber-300">
              <Gift className="size-4" />
              Collect {b.campaign.stampsRequired} stamps → {b.campaign.reward}
            </p>
            {b.campaign.terms && (
              <p className="mt-2 text-center text-[11.5px] leading-relaxed text-white/50">
                {b.campaign.terms}
              </p>
            )}
          </div>
        )}

        {/* Join panel — same glass treatment. */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(15,12,30,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl sm:p-8">
          {!b.acceptingJoins ? (
            <EmptyState
              title="Not accepting new members right now"
              description={`${b.name} has paused new sign-ups. Ask at the counter, or come back soon.`}
            />
          ) : session && !switching ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                  Almost there
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-white">
                  {session.actor.name
                    ? `Hi ${session.actor.name.split(' ')[0]}!`
                    : 'Welcome back!'}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Get your {b.name} card on {session.actor.phone ?? session.actor.email}.
                </p>
              </div>
              <ConsentCheckbox
                text={b.consentText}
                checked={marketingConsent}
                onChange={setMarketingConsent}
                businessName={b.name}
              />
              <Button
                size="lg"
                variant="brand"
                className="w-full"
                loading={join.isPending}
                onClick={() => join.mutate()}
              >
                Get my card <ArrowRight className="size-4" />
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-white/60 transition-colors hover:text-white/80"
                onClick={() => {
                  customerSession.clear();
                  setSwitching(false);
                }}
              >
                {PHONE_AUTH_ENABLED ? 'Use a different phone or email' : 'Use a different email'}
              </button>
            </div>
          ) : (
            <>
              <OtpLogin
                role="CUSTOMER"
                title={
                  PHONE_AUTH_ENABLED ? 'Join with your phone or email' : 'Join with your email'
                }
                subtitle="One quick code — no app, no password, no spam."
                allowRegistration
                nameLabel="Your name"
                submitLabel="Join program"
                onAuthenticated={() => join.mutate()}
              />
              <div className="mt-4 border-t border-white/10 pt-4">
                <ConsentCheckbox
                  text={b.consentText}
                  checked={marketingConsent}
                  onChange={setMarketingConsent}
                  businessName={b.name}
                />
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-white/40">
          Powered by <span className="font-medium text-white/60">Stamposa</span>
        </p>
      </section>
    </JoinShell>
  );
}

/** Full-page aurora shell used by every join state (loading, error, main). */
function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#1a1a26] text-white">
      <style>{auroraStyles}</style>
      <AuroraBackdrop />
      <GridPattern />
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        {children}
      </main>
    </div>
  );
}

/**
 * Unbundled and off by default — joining the programme never depends on
 * agreeing to marketing. The exact wording shown here is stored with the
 * customer's answer.
 */
function ConsentCheckbox({
  text,
  checked,
  onChange,
  businessName,
}: {
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  businessName?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-white/70">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/[0.06] text-brand-500 focus:ring-2 focus:ring-brand-500/40"
        />
        <span>{text}</span>
      </label>
      <p className="text-[11.5px] leading-relaxed text-white/45">
        By continuing you agree to how {businessName ? `${businessName} and Stamposa` : 'Stamposa'} handle your data —
        see our{' '}
        <a
          href={siteHref('/legal/privacy')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-300 underline decoration-amber-300/40 underline-offset-2 hover:text-amber-200"
        >
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
