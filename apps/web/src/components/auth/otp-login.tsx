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
import { PHONE_AUTH_ENABLED } from '@/lib/features';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { OtpInput } from '@/components/ui/otp-input';

const DEFAULT_REGION = (process.env.NEXT_PUBLIC_DEFAULT_PHONE_REGION ?? 'IN') as CountryCode;

const clients = {
  MERCHANT: merchantClient,
  STAFF: staffClient,
  CUSTOMER: customerClient,
} as const;

type Step = 'identifier' | 'code' | 'name';

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

  const [step, setStep] = useState<Step>('identifier');
  const [identifierInput, setIdentifierInput] = useState('');
  /** The normalised value the code was actually sent to. */
  const [sentTo, setSentTo] = useState('');
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

  const requestCode = async (target?: string) => {
    setError(null);
    const raw = (target ?? identifierInput).trim();

    // Anything with an "@" is an email attempt; otherwise validate it as a
    // phone number here so the person gets an immediate, specific error
    // instead of a round trip. The server normalises either way. When phone
    // sign-in is disabled (no SMS gateway yet), only email is accepted.
    let value: string;
    if (raw.includes('@') || !PHONE_AUTH_ENABLED) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        setError('Enter a valid email address.');
        return;
      }
      value = raw.toLowerCase();
    } else {
      const parsed = parsePhoneNumberFromString(raw, DEFAULT_REGION);
      if (!parsed || !parsed.isValid()) {
        setError('Enter a valid phone number or an email address.');
        return;
      }
      value = parsed.number;
    }

    setBusy(true);
    try {
      const res = await api.requestOtp(value);
      setSentTo(value);
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
      const result = await api.verifyOtp(sentTo, fullCode);
      if (result.status === 'AUTHENTICATED' && result.session) {
        finish(result.session);
      } else if (result.registrationToken) {
        if (!allowRegistration) {
          setError(PHONE_AUTH_ENABLED ? 'No account found for that phone number or email.' : 'No account found for that email.');
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

      {step === 'identifier' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void requestCode();
          }}
        >
          <Field
            label={PHONE_AUTH_ENABLED ? "Phone number or email" : "Email address"}
            error={error ?? undefined}
            hint={
              PHONE_AUTH_ENABLED
                ? `Numbers without a country code are treated as ${DEFAULT_REGION === 'IN' ? '+91 (India)' : DEFAULT_REGION}.`
                : undefined
            }
          >
            {(p) => (
              <Input
                {...p}
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder={PHONE_AUTH_ENABLED ? "+91 98765 43210" : "you@example.com"}
                value={identifierInput}
                onChange={(e) => setIdentifierInput(e.target.value)}
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
              setStep('identifier');
              setError(null);
            }}
            className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-strong"
          >
            <ArrowLeft className="size-4" /> {sentTo.includes('@') ? sentTo : formatPhone(sentTo)}
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
              onClick={() => void requestCode(sentTo)}
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
            {sentTo.includes('@') ? sentTo : formatPhone(sentTo)} verified. One last thing —
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
