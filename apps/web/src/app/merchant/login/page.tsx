'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { OtpLogin } from '@/components/auth/otp-login';
import { AuthShell } from '@/components/auth/auth-shell';
import { useStoredSession } from '@/lib/auth/use-stored-session';

export default function MerchantLoginPage() {
  const router = useRouter();
  const { session, ready } = useStoredSession('MERCHANT');

  useEffect(() => {
    if (ready && session) router.replace('/merchant/dashboard');
  }, [session, ready, router]);

  if (!ready || session) return null;

  return (
    <AuthShell
      footer={
        <>
          Work at the counter?{' '}
          <Link href="/staff/login" className="font-medium text-brand-600 hover:text-brand-700">
            Staff login
          </Link>
        </>
      }
    >
      <OtpLogin
        role="MERCHANT"
        title="Merchant sign in"
        subtitle="New here? Enter your phone — we'll create your account."
        allowRegistration
        nameLabel="Your full name"
        submitLabel="Create account"
        onAuthenticated={(s) =>
          router.replace(s.business ? '/merchant/dashboard' : '/merchant/onboarding')
        }
      />
    </AuthShell>
  );
}
