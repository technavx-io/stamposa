'use client';

import Link from 'next/link';
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
import { Button } from '@/components/ui/button';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { EmptyState, PageLoader, Panel } from '@/components/ui/surface';
import { StampGrid } from '@/components/stamp-grid';
import { joinBackground } from '@/lib/card-bg';

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
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <Panel className="w-full max-w-sm">
          <EmptyState
            title="Business not found"
            description="This join link doesn't exist. Double-check the QR code or ask the business for a new one."
            action={
              <Link href="/" className="text-sm font-medium text-brand-600">
                Go home
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  const b = business.data;

  return (
    <div
      className="flex min-h-dvh flex-col items-center px-4 pb-10"
      style={{ background: joinBackground(b.style) }}
    >
      {/* Business header */}
      <div className="flex w-full max-w-md flex-col items-center pt-12 pb-8 text-center text-white">
        <LogoAvatar name={b.name} logoUrl={b.logoUrl} size="xl" className="shadow-lg" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{b.name}</h1>
        {b.address && (
          <p className="mt-1 flex items-center gap-1 text-sm text-white/50">
            <MapPin className="size-3.5" /> {b.address}
          </p>
        )}
        {b.campaign && (
          <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-white/80">
              <Stamp className="size-4 text-brand-300" /> {b.campaign.name}
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
            <p className="flex items-center justify-center gap-1.5 text-sm text-amber-200">
              <Gift className="size-4" />
              Collect {b.campaign.stampsRequired} stamps → {b.campaign.reward}
            </p>
            {b.campaign.terms && (
              <p className="mt-2 text-center text-[11.5px] leading-relaxed text-white/45">
                {b.campaign.terms}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Join panel */}
      <Panel className="w-full max-w-md p-6 sm:p-8">
        {!b.acceptingJoins ? (
          <EmptyState
            title="Not accepting new members right now"
            description={`${b.name} has paused new sign-ups. Ask at the counter, or come back soon.`}
          />
        ) : session && !switching ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-strong">
                {session.actor.name ? `Hi ${session.actor.name.split(' ')[0]}!` : 'Welcome back!'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Get your {b.name} card on {session.actor.phone}.
              </p>
            </div>
            <ConsentCheckbox
              text={b.consentText}
              checked={marketingConsent}
              onChange={setMarketingConsent}
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
              className="w-full text-center text-sm text-muted transition-colors hover:text-body"
              onClick={() => {
                customerSession.clear();
                setSwitching(false);
              }}
            >
              Use a different phone number
            </button>
          </div>
        ) : (
          <>
            <OtpLogin
              role="CUSTOMER"
              title="Join with your phone"
              subtitle="One quick OTP — no app, no password, no spam."
              allowRegistration
              nameLabel="Your name"
              submitLabel="Join program"
              onAuthenticated={() => join.mutate()}
            />
            <div className="mt-4 border-t border-line-soft pt-4">
              <ConsentCheckbox
                text={b.consentText}
                checked={marketingConsent}
                onChange={setMarketingConsent}
              />
            </div>
          </>
        )}
      </Panel>

      <p className="mt-6 text-xs text-white/30">
        Powered by <span className="font-medium text-white/50">Stamposa</span>
      </p>
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
}: {
  text: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-body">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line text-brand-600 focus:ring-2 focus:ring-brand-500/30"
      />
      <span>{text}</span>
    </label>
  );
}
