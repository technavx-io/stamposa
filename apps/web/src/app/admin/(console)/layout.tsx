'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogPanel } from '@headlessui/react';
import {
  Activity,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  UserSearch,
  Users,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin-client';
import { ApiError } from '@/lib/api/client';
import { LoadError } from '@/components/ui/load-error';
import type { AdminCapability } from '@/lib/api/admin-types';
import { adminSession, useAdminSession } from '@/lib/admin/admin-session';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/ui/surface';

const nav: { href: string; label: string; icon: typeof LayoutDashboard; capability?: AdminCapability }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/merchants', label: 'Merchants', icon: Building2, capability: 'merchants.read' },
  { href: '/admin/customers', label: 'Customer lookup', icon: UserSearch, capability: 'customers.lookup' },
  { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare, capability: 'feedback.read' },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText, capability: 'audit.read' },
  { href: '/admin/team', label: 'Team', icon: Users, capability: 'team.manage' },
  { href: '/admin/health', label: 'System health', icon: Activity, capability: 'platform.read' },
];

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  OPS: 'Operations',
  SUPPORT: 'Support',
  FINANCE: 'Finance',
  ANALYST: 'Analyst',
};

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, ready } = useAdminSession();
  const [drawer, setDrawer] = useState(false);

  const me = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: adminApi.me,
    enabled: !!session,
    retry: false,
  });

  useEffect(() => {
    if (ready && !session) router.replace('/admin/login');
  }, [ready, session, router]);

  const authFailed =
    me.isError && me.error instanceof ApiError && (me.error.status === 401 || me.error.status === 403);

  useEffect(() => {
    if (authFailed) {
      adminSession.clear();
      router.replace('/admin/login');
    }
  }, [authFailed, router]);

  if (me.isError && !authFailed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <LoadError
          className="w-full max-w-sm"
          title="Couldn't reach the console"
          error={me.error}
          onRetry={() => void me.refetch()}
        />
      </div>
    );
  }

  if (!ready || !session || me.isPending) return <PageLoader label="Opening the console…" />;
  if (!me.data) return null;

  const allowed = nav.filter((n) => !n.capability || me.data.capabilities.includes(n.capability));

  const signOut = async () => {
    const refreshToken = adminSession.get()?.tokens.refreshToken;
    adminSession.clear();
    if (refreshToken) await adminApi.logout(refreshToken).catch(() => undefined);
    router.replace('/admin/login');
  };

  const railContent = (onNavigate?: () => void) => (
    <>
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 ring-1 ring-white/10">
          <ShieldCheck className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Stamposa</p>
          <p className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">Operator</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {allowed.map((item) => {
          // The dashboard root matches exactly; sections match their subtree.
          const active =
            item.href === '/admin' ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-100',
              )}
            >
              <item.icon className={cn('size-4', active ? 'text-indigo-400' : 'text-slate-500')} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
            {me.data.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-200">{me.data.name}</p>
            <p className="truncate font-mono text-[10px] tracking-wide text-slate-500 uppercase">
              {roleLabels[me.data.role] ?? me.data.role}
            </p>
          </div>
          <button
            onClick={() => void signOut()}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-slate-900 lg:flex">
        {railContent()}
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex size-7 items-center justify-center rounded-md bg-slate-900 text-white">
            <ShieldCheck className="size-3.5" />
          </span>
          Operator
        </Link>
        <button
          onClick={() => setDrawer(true)}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </header>

      <Dialog open={drawer} onClose={() => setDrawer(false)} className="relative z-50 lg:hidden">
        <div className="fixed inset-0 bg-slate-950/50" aria-hidden />
        <DialogPanel className="fixed inset-y-0 left-0 flex w-64 flex-col bg-slate-900">
          <button
            onClick={() => setDrawer(false)}
            className="absolute top-4 right-3 rounded-md p-1.5 text-slate-500 hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
          {railContent(() => setDrawer(false))}
        </DialogPanel>
      </Dialog>

      <main className="min-w-0 flex-1 lg:pl-56">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

