'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import { MerchantContext } from '@/lib/auth/merchant-context';
import { merchantSession } from '@/lib/auth/session';
import { useStoredSession } from '@/lib/auth/use-stored-session';
import { MerchantShell } from '@/components/layout/merchant-shell';
import { LoadError } from '@/components/ui/load-error';
import { PageLoader } from '@/components/ui/surface';

/**
 * Guard for every merchant portal page: requires a session, loads /auth/me,
 * and routes merchants without a business into onboarding.
 *
 * Only auth failures (401/403) clear the session — a flaky network or an
 * API restart shows a retry screen instead of silently logging people out.
 */
export default function MerchantPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session, ready } = useStoredSession('MERCHANT');

  const me = useQuery({
    queryKey: ['merchant', 'me'],
    queryFn: merchantApi.auth.me,
    enabled: !!session,
  });

  const authFailed =
    me.isError && me.error instanceof ApiError && (me.error.status === 401 || me.error.status === 403);

  useEffect(() => {
    if (ready && !session) router.replace('/merchant/login');
  }, [session, ready, router]);

  useEffect(() => {
    if (authFailed) {
      merchantSession.clear();
      router.replace('/merchant/login');
    }
  }, [authFailed, router]);

  useEffect(() => {
    if (me.data && !me.data.business) router.replace('/merchant/onboarding');
  }, [me.data, router]);

  if (me.isError && !authFailed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
        <LoadError
          className="w-full max-w-sm"
          title="Couldn't reach Stamposa"
          error={me.error}
          onRetry={() => void me.refetch()}
        />
      </div>
    );
  }

  if (!session || me.isPending || me.isError || !me.data?.business) {
    return <PageLoader label="Loading your dashboard…" />;
  }

  return (
    <MerchantContext.Provider
      value={{ me: me.data, business: me.data.business, refresh: me.refetch }}
    >
      <MerchantShell>{children}</MerchantShell>
    </MerchantContext.Provider>
  );
}
