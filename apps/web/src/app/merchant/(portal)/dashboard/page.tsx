'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Gift,
  ImagePlus,
  QrCode,
  Stamp,
  UserPlus,
  Users,
} from 'lucide-react';
import { merchantApi } from '@/lib/api/endpoints';
import { useMerchant } from '@/lib/auth/merchant-context';
import { cn, timeAgo } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, EmptyState, Panel, PanelHeader, Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

export default function DashboardPage() {
  const { me } = useMerchant();
  const dashboard = useQuery({
    queryKey: ['merchant', 'dashboard'],
    queryFn: merchantApi.dashboard,
    refetchInterval: 15_000,
  });

  const firstName = me.actor.name?.split(' ')[0];

  if (dashboard.isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }
  if (dashboard.isError || !dashboard.data) {
    return (
      <LoadError
        title="Couldn't load the dashboard"
        error={dashboard.error}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const { stats, campaign, activity, checklist } = dashboard.data;
  const setupSteps = [
    { done: true, label: 'Create your business profile', href: '/merchant/settings' },
    { done: checklist.hasCampaign, label: 'Launch a loyalty campaign', href: '/merchant/campaign' },
    { done: checklist.hasLogo, label: 'Add your logo', href: '/merchant/settings', icon: ImagePlus },
    { done: checklist.hasStaff, label: 'Add counter staff', href: '/merchant/staff', icon: UserPlus },
    { done: checklist.hasCustomers, label: 'Get your first customer', href: '/merchant/qr', icon: QrCode },
  ];
  const remaining = setupSteps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader
        title={firstName ? `Good to see you, ${firstName}` : 'Dashboard'}
        description="Here's how your loyalty program is doing."
        action={
          <Link
            href="/merchant/qr"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <QrCode className="size-4" /> View join QR <ArrowRight className="size-3.5" />
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Customers" value={stats.customers} />
        <StatCard icon={Stamp} label="Stamps today" value={stats.stampsToday} accent />
        <StatCard icon={Gift} label="Rewards earned" value={stats.rewardsEarned} />
        <Link href="/merchant/rewards" className="contents">
          <StatCard
            icon={Gift}
            label="Rewards waiting"
            value={stats.rewardsPending}
            tone={stats.rewardsPending > 0 ? 'amber' : undefined}
            hint={
              stats.rewardsPending > 0
                ? 'to hand over'
                : `${stats.rewardsRedeemed} handed over`
            }
          />
        </Link>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        {/* Activity */}
        <Panel className="lg:col-span-2">
          <PanelHeader title="Live activity" description="Latest stamps across the counter" />
          {activity.length === 0 ? (
            <EmptyState
              icon={<Stamp className="size-6" />}
              title="No stamps yet"
              description="Print your QR code and start stamping — activity shows up here instantly."
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {activity.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/merchant/customers/${item.membershipId}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas"
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        item.type === 'REDEMPTION'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : item.completedCard
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                            : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
                      )}
                    >
                      {item.type === 'REDEMPTION' ? (
                        <Check className="size-4" />
                      ) : item.completedCard ? (
                        <Gift className="size-4" />
                      ) : (
                        <Stamp className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-strong">
                        <span className="font-medium">{item.customerName ?? item.customerCode}</span>
                        {item.type === 'REDEMPTION'
                          ? ` received: ${item.rewardText}`
                          : item.completedCard
                            ? ' completed a card 🎉'
                            : ' collected a stamp'}
                      </p>
                      <p className="text-xs text-muted">
                        by {item.issuerName} · {timeAgo(item.createdAt)}
                      </p>
                    </div>
                    {item.type === 'REDEMPTION' ? (
                      <Badge tone="green">Redeemed</Badge>
                    ) : item.completedCard ? (
                      <Badge tone="amber">Reward</Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          {/* Campaign snapshot */}
          <Panel>
            <PanelHeader title="Campaign" />
            <div className="px-5 pb-5">
              {campaign ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-strong">{campaign.name}</p>
                    <Badge tone={campaign.status === 'ACTIVE' ? 'green' : 'amber'}>
                      {campaign.status === 'ACTIVE' ? 'Live' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {campaign.stampsRequired} stamps → {campaign.reward}
                  </p>
                  <p className="mt-3 text-xs text-muted">
                    {campaign.memberCount} customer{campaign.memberCount === 1 ? '' : 's'} enrolled
                  </p>
                  <Link
                    href="/merchant/campaign"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Manage <ArrowRight className="size-3.5" />
                  </Link>
                </>
              ) : (
                <EmptyState
                  title="No campaign yet"
                  description="Launch one to start stamping."
                  action={
                    <Link href="/merchant/campaign" className="text-sm font-medium text-brand-600">
                      Create campaign →
                    </Link>
                  }
                />
              )}
            </div>
          </Panel>

          {/* Setup checklist */}
          {remaining > 0 && (
            <Panel>
              <PanelHeader title="Finish setting up" description={`${remaining} step${remaining === 1 ? '' : 's'} left`} />
              <ul className="space-y-1 px-3 pb-4">
                {setupSteps.map((step) => (
                  <li key={step.label}>
                    <Link
                      href={step.href}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-canvas"
                    >
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full border',
                          step.done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-line text-transparent',
                        )}
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <span className={step.done ? 'text-muted line-through' : 'text-body'}>
                        {step.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  tone,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: boolean;
  tone?: 'amber';
  hint?: string;
}) {
  return (
    <Panel
      className={cn(
        'p-5',
        accent &&
          'border-brand-200 bg-gradient-to-br from-brand-50/80 to-white dark:border-brand-500/40 dark:from-brand-500/15 dark:to-surface',
        tone === 'amber' &&
          'border-amber-300 bg-gradient-to-br from-amber-50 to-white dark:border-amber-500/40 dark:from-amber-500/15 dark:to-surface',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <Icon
          className={cn(
            'size-4',
            tone === 'amber' ? 'text-amber-500' : accent ? 'text-brand-500' : 'text-zinc-300',
          )}
        />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-strong tabular-nums">
        {value.toLocaleString('en-IN')}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Panel>
  );
}
