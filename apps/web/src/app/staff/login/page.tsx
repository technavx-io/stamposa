'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { OtpLogin } from '@/components/auth/otp-login';
import { AuthShell } from '@/components/auth/auth-shell';
import { useStoredSession } from '@/lib/auth/use-stored-session';

export default function StaffLoginPage() {
  const router = useRouter();
  const { session, ready } = useStoredSession('STAFF');

  useEffect(() => {
    if (ready && session) router.replace('/staff');
  }, [session, ready, router]);

  if (!ready || session) return null;

  return (
    <AuthShell
      footer={
        <>
          Own the business?{' '}
          <Link href="/merchant/login" className="font-medium text-brand-600 hover:text-brand-700">
            Merchant sign in
          </Link>
        </>
      }
    >
      <OtpLogin
        role="STAFF"
        title="Staff login"
        subtitle="Use the phone number your manager registered for you."
        allowRegistration={false}
        onAuthenticated={() => router.replace('/staff')}
      />
    </AuthShell>
  );
}
