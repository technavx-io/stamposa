'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { ArrowLeft, MessageSquareLock } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, customerClient, merchantClient, staffClient } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import type { ActorRole, AuthSession } from '@/lib/api/types';
import { sessionFor } from '@/lib/auth/session';
import { formatPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { OtpInput } from '@/components/ui/otp-input';

const DEFAULT_REGION = (process.env.NEXT_PUBLIC_DEFAULT_PHONE_REGION ?? 'IN') as CountryCode;

const clients = {
  MERCHANT: merchantClient,
  STAFF: staffClient,
  CUSTOMER: customerClient,
} as const;

type Step = 'phone' | 'code' | 'name';

export interface OtpLoginProps {
  role: ActorRole;
  /** Shown above the form, e.g. "Sign in to your dashboard". */
  title: string;
  subtitle?: string;
  /** Merchants/customers can create accounts; staff accounts are invite-only. */
  allowRegistration: boolean;
  nameLabel?: string;
  submitLabel?: string;
  onAuthenticated: (session: AuthSession) => void;
}

export function OtpLogin({
  role,
  title,
  subtitle,
  allowRegistration,
  nameLabel = 'Your name',
  submitLabel = 'Continue',
  onAuthenticated,
}: OtpLoginProps) {
  const api = useMemo(() => authApi(role, clients[role]), [role]);

  const [step, setStep] = useState<Step>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneE164, setPhoneE164] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [registrationToken, setRegistrationToken] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const verifyingRef = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- restart only on active/inactive flip

  const requestCode = async (targetPhone?: string) => {
    setError(null);
    const parsed = parsePhoneNumberFromString(targetPhone ?? phoneInput, DEFAULT_REGION);
    if (!parsed || !parsed.isValid()) {
      setError('Enter a valid phone number. Include the country code if outside India.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.requestOtp(parsed.number);
      setPhoneE164(parsed.number);
      setDevCode(res.devCode ?? null);
      setResendIn(res.resendInSec);
      setCode('');
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (fullCode: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setError(null);
    setBusy(true);
    try {
      const result = await api.verifyOtp(phoneE164, fullCode);
      if (result.status === 'AUTHENTICATED' && result.session) {
        finish(result.session);
      } else if (result.registrationToken) {
        if (!allowRegistration) {
          setError('No account found for this phone number.');
          return;
        }
        setRegistrationToken(result.registrationToken);
        setStep('name');
      }
    } catch (e) {
      setCode('');
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      verifyingRef.current = false;
    }
  };

  const register = async () => {
    if (name.trim().length < 2) {
      setError('Enter your name (at least 2 characters).');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      finish(await api.register(registrationToken, name.trim()));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = (session: AuthSession) => {
    sessionFor(role).set({ tokens: session.tokens, actor: session.actor });
    toast.success(`Welcome${session.actor.name ? `, ${session.actor.name.split(' ')[0]}` : ''}!`);
    onAuthenticated(session);
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-strong">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      {step === 'phone' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
        >
          <Field
            label="Phone number"
            error={error ?? undefined}
            hint={`Numbers without a country code are treated as ${DEFAULT_REGION === 'IN' ? '+91 (India)' : DEFAULT_REGION}.`}
          >
            {(p) => (
              <Input
                {...p}
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                autoFocus
                required
              />
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} variant="brand">
            Send code
          </Button>
        </form>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setError(null);
            }}
            className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-strong"
          >
            <ArrowLeft className="size-4" /> {formatPhone(phoneE164)}
          </button>

          <Field label="Enter the 6-digit code" error={error ?? undefined}>
            {() => (
              <OtpInput
                value={code}
                onChange={setCode}
                onComplete={(v) => void verify(v)}
                disabled={busy}
              />
            )}
          </Field>

          {devCode && (
            <button
              type="button"
              onClick={() => {
                setCode(devCode);
                void verify(devCode);
              }}
              className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[13px] text-amber-800 transition-colors hover:bg-amber-100"
            >
              <MessageSquareLock className="size-4 shrink-0" />
              <span>
                Dev mode — SMS not configured. Your code is <strong>{devCode}</strong>. Tap to use
                it.
              </span>
            </button>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Didn&apos;t get it?</span>
            <button
              type="button"
              disabled={resendIn > 0 || busy}
              onClick={() => void requestCode(phoneE164)}
              className="font-medium text-brand-600 transition-colors hover:text-brand-700 disabled:cursor-not-allowed disabled:text-muted"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </div>
      )}

      {step === 'name' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void register();
          }}
        >
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
            {formatPhone(phoneE164)} verified. One last thing —
          </p>
          <Field label={nameLabel} error={error ?? undefined}>
            {(p) => (
              <Input
                {...p}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha Patel"
                autoFocus
                required
                minLength={2}
                maxLength={60}
              />
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} variant="brand">
            {submitLabel}
          </Button>
        </form>
      )}
    </div>
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'STAFF_NOT_FOUND') {
      return 'No staff account for this number. Ask the business owner to add you first.';
    }
    return e.message;
  }
  return 'Something went wrong. Check your connection and try again.';
}
