'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dialog, DialogPanel } from '@headlessui/react';
import {
  BarChart3,
  BookOpen,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Receipt,
  Settings,
  ShieldAlert,
  Stamp,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type { ImpersonationInfo } from '@/lib/api/types';
import { merchantApi } from '@/lib/api/endpoints';
import { merchantSession } from '@/lib/auth/session';
import { useMerchant } from '@/lib/auth/merchant-context';
import { cn } from '@/lib/utils';
import { LogoAvatar } from '@/components/ui/logo-avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';
import { MessageSquarePlus } from 'lucide-react';

const nav = [
  { href: '/merchant/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/merchant/campaign', label: 'Campaign', icon: Stamp },
  { href: '/merchant/qr', label: 'QR code', icon: QrCode },
  { href: '/merchant/customers', label: 'Customers', icon: Users },
  { href: '/merchant/rewards', label: 'Rewards', icon: Gift },
  { href: '/merchant/transactions', label: 'Transactions', icon: Receipt },
  { href: '/merchant/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/merchant/staff', label: 'Staff', icon: UserCog },
  { href: '/merchant/settings', label: 'Settings', icon: Settings },
  { href: '/guide', label: 'Guide', icon: BookOpen },
];

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { me } = useMerchant();
  const imp = me.impersonation ?? null;

  return (
    <div className={cn('min-h-dvh bg-canvas lg:flex', imp && 'pt-10')}>
      {imp && <ImpersonationBanner imp={imp} businessName={me.business?.name ?? ''} />}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 z-30 hidden w-60 flex-col border-r border-line/80 bg-surface lg:flex',
          imp ? 'top-10 bottom-0' : 'inset-y-0',
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className={cn('sticky z-20 flex h-14 items-center justify-between border-b border-line/80 bg-surface/90 px-4 backdrop-blur lg:hidden', imp ? 'top-10' : 'top-0')}>
        <BrandMark />
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-muted hover:bg-surface-2"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <Dialog open={drawerOpen} onClose={() => setDrawerOpen(false)} className="relative z-50 lg:hidden">
        <div className="fixed inset-0 bg-zinc-950/40" aria-hidden />
        <DialogPanel className="fixed inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl">
          <div className="flex items-center justify-between px-4 pt-4">
            <BrandMark />
            <button
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-2 text-muted hover:bg-surface-2"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>
          <SidebarContent onNavigate={() => setDrawerOpen(false)} hideBrand />
        </DialogPanel>
      </Dialog>

      <main className="min-w-0 flex-1 lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

/**
 * The always-visible strip shown while an admin is inside a merchant's
 * account. Counts down to the forced end of the support session; when it
 * hits zero the (already-expired) session is cleared client-side too.
 */
function ImpersonationBanner({ imp, businessName }: { imp: ImpersonationInfo; businessName: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const leftSec = Math.max(0, Math.floor((new Date(imp.expiresAt).getTime() - now) / 1000));

  useEffect(() => {
    if (leftSec > 0) return;
    merchantSession.clear();
    router.replace('/admin/merchants');
  }, [leftSec, router]);

  const mm = Math.floor(leftSec / 60);
  const ss = String(leftSec % 60).padStart(2, '0');

  const endNow = () => {
    merchantSession.clear();
    window.location.href = '/admin/merchants';
  };

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-10 items-center justify-center gap-3 bg-amber-500 px-4 text-[13px] font-medium text-amber-950">
      <ShieldAlert className="size-4 shrink-0" />
      <span className="truncate">
        Support session — viewing <strong>{businessName}</strong> as {imp.adminLabel} · ends in{' '}
        <span className="tabular-nums">{mm}:{ss}</span>
      </span>
      <button
        onClick={endNow}
        className="shrink-0 rounded-md bg-amber-950/10 px-2.5 py-1 font-semibold transition-colors hover:bg-amber-950/20"
      >
        Exit
      </button>
    </div>
  );
}

function BrandMark() {
  return (
    <Link
      href="/merchant/dashboard"
      className="flex items-center gap-2 font-semibold tracking-tight text-strong"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Stamp className="size-4" />
      </span>
      Stamposa
    </Link>
  );
}

function SidebarContent({
  onNavigate,
  hideBrand,
}: {
  onNavigate?: () => void;
  hideBrand?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { business } = useMerchant();

  const logout = async () => {
    const refreshToken = merchantSession.get()?.tokens.refreshToken;
    merchantSession.clear();
    if (refreshToken) await merchantApi.auth.logout(refreshToken).catch(() => undefined);
    router.replace('/merchant/login');
  };

  return (
    <>
      {!hideBrand && (
        <div className="px-4 pt-5">
          <BrandMark />
        </div>
      )}
      <nav className="mt-6 flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                  : 'text-body hover:bg-surface-2 hover:text-strong',
              )}
            >
              <item.icon className={cn('size-4.5', active ? 'text-brand-600' : 'text-muted')} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-line-soft p-3">
        <FeedbackDialog
          send={merchantApi.sendFeedback}
          renderTrigger={(openDialog) => (
            <button
              onClick={() => {
                onNavigate?.();
                openDialog();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-strong"
            >
              <MessageSquarePlus className="size-4.5 text-muted" />
        <div className="px-2">
          <ThemeToggle className="w-full justify-center" />
        </div>
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <LogoAvatar name={business.name} logoUrl={business.logoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-strong">{business.name}</p>
            <p className="truncate text-xs text-muted">/{business.slug}</p>
          </div>
          <button
            onClick={() => void logout()}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-body"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}
