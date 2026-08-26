'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Gift, LogOut, WalletCards } from 'lucide-react';
import { customerApi } from '@/lib/api/endpoints';
import { customerSession } from '@/lib/auth/session';
import { useStoredSession } from '@/lib/auth/use-stored-session';
import { OtpLogin } from '@/components/auth/otp-login';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { EmptyState, PageLoader, Panel } from '@/components/ui/surface';
import { ProgressPill } from '@/components/progress-pill';

export default function MyCardsPage() {
  const router = useRouter();
  const { session, ready } = useStoredSession('CUSTOMER');

  const cards = useQuery({
    queryKey: ['customer', 'cards'],
    queryFn: customerApi.cards,
    enabled: !!session,
  });

  if (!ready) return <PageLoader />;

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <Panel className="w-full max-w-sm p-6 sm:p-8">
          <OtpLogin
            role="CUSTOMER"
            title="My loyalty cards"
            subtitle="Verify your phone to see every card you've collected."
            allowRegistration
            onAuthenticated={() => undefined}
          />
        </Panel>
      </div>
    );
  }

  if (cards.isPending) return <PageLoader label="Finding your cards…" />;

  const logout = async () => {
    const refreshToken = customerSession.get()?.tokens.refreshToken;
    customerSession.clear();
    if (refreshToken) await customerApi.auth.logout(refreshToken).catch(() => undefined);
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-strong">My cards</h1>
            <p className="mt-0.5 text-sm text-muted">
              {session.actor.name ? `${session.actor.name} · ` : ''}
              {session.actor.phone}
            </p>
          </div>
          <button
            onClick={() => void logout()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-strong"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>

        {!cards.data || cards.data.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<WalletCards className="size-6" />}
              title="No cards yet"
              description="Scan a participating business's QR code to collect your first loyalty card."
              action={
                <Link href="/guide#customer" className="text-sm font-medium text-brand-600">
                  How it works →
                </Link>
              }
            />
          </Panel>
        ) : (
          <ul className="space-y-3">
            {cards.data.map((card) => (
              <li key={card.id}>
                <Link href={`/card/${card.id}`} className="block">
                  <Panel
                    className={`flex items-center gap-4 p-4 transition-shadow hover:shadow-md ${
                      card.pendingRewards.length > 0 ? 'border-amber-300 bg-amber-50/40' : ''
                    }`}
                  >
                    <LogoAvatar name={card.business.name} logoUrl={card.business.logoUrl} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-strong">{card.business.name}</p>
                      <p className="truncate text-xs text-muted">
                        {card.campaign.name} · <span className="font-mono">{card.formattedCode}</span>
                      </p>
                      {card.pendingRewards.length > 0 ? (
                        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-amber-700">
                          <Gift className="size-3.5" />
                          {card.pendingRewards.length} reward
                          {card.pendingRewards.length === 1 ? '' : 's'} ready to claim
                        </p>
                      ) : (
                        <div className="mt-2">
                          <ProgressPill current={card.stampCount} total={card.campaign.stampsRequired} />
                        </div>
                      )}
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-zinc-300" />
                  </Panel>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
