'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { adminApi } from '@/lib/api/admin-client';
import type { AdminRole, AdminTeamMember } from '@/lib/api/admin-types';
import { useAdminSession } from '@/lib/admin/admin-session';
import { formatDate, timeAgo } from '@/lib/utils';
import { Card, EmptyRow, Pill } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

const roles: { value: AdminRole; label: string; description: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super admin', description: 'Everything, including managing this team' },
  { value: 'OPS', label: 'Operations', description: 'Merchants, suspensions, impersonation' },
  { value: 'SUPPORT', label: 'Support', description: 'Read merchants, look up customers, impersonate' },
  { value: 'FINANCE', label: 'Finance', description: 'Read-only across merchants and billing' },
  { value: 'ANALYST', label: 'Analyst', description: 'Read-only reporting access' },
];

const roleLabel = (r: AdminRole) => roles.find((x) => x.value === r)?.label ?? r;

export default function AdminTeamPage() {
  const queryClient = useQueryClient();
  const { session } = useAdminSession();
  const [addOpen, setAddOpen] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState<{ email: string; name: string; role: AdminRole }>({
    email: '',
    name: '',
    role: 'SUPPORT',
  });

  const team = useQuery({ queryKey: ['admin', 'team'], queryFn: adminApi.team });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });

  const create = useMutation({
    mutationFn: () => adminApi.createAdmin(form),
    onSuccess: async (result) => {
      setCreated({ email: result.admin.email, password: result.temporaryPassword });
      setAddOpen(false);
      setForm({ email: '', name: '', role: 'SUPPORT' });
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not add that admin.'),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; isActive?: boolean; role?: AdminRole }) =>
      adminApi.updateAdmin(input.id, { isActive: input.isActive, role: input.role }),
    onSuccess: async () => {
      toast.success('Team member updated');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update.'),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.revokeSessions(id),
    onSuccess: async () => {
      toast.success('Signed out of every device');
      await invalidate();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not revoke sessions.'),
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Platform team</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Your own staff. Everyone signs in with a password plus an authenticator app.
          </p>
        </div>
        <Button variant="brand" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" /> Add admin
        </Button>
      </div>

      <Card>
        {team.isPending ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : team.isError ? (
          <LoadError className="border-0" error={team.error} onRetry={() => void team.refetch()} />
        ) : !team.data || team.data.length === 0 ? (
          <EmptyRow>No admins yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-50">
            {team.data.map((a) => (
              <TeamRow
                key={a.id}
                member={a}
                isSelf={a.id === session?.admin.id}
                onToggleActive={() => update.mutate({ id: a.id, isActive: !a.isActive })}
                onRoleChange={(role) => update.mutate({ id: a.id, role })}
                onRevoke={() => revoke.mutate(a.id)}
                busy={update.isPending || revoke.isPending}
              />
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a platform admin"
        description="They'll receive a temporary password and set up their authenticator on first sign-in."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="ops@stamposa.com"
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Name</label>
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Priya Sharma"
              className="h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
              className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-2 focus:outline-brand-600/20"
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="text-[13px] text-zinc-500">
              {roles.find((r) => r.value === form.role)?.description}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" loading={create.isPending}>
              Add admin
            </Button>
          </div>
        </form>
      </Modal>

      {/* The temporary password is shown once and never stored in plain text. */}
      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="Share this temporary password"
        description="It won't be shown again. They'll be asked to set up two-factor on first sign-in."
      >
        {created && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-[13px] text-amber-800">{created.email}</p>
              <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-amber-900">
                {created.password}
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                void navigator.clipboard.writeText(created.password);
                toast.success('Password copied');
              }}
            >
              <Copy className="size-4" /> Copy password
            </Button>
            <Button variant="brand" className="w-full" onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

function TeamRow({
  member,
  isSelf,
  onToggleActive,
  onRoleChange,
  onRevoke,
  busy,
}: {
  member: AdminTeamMember;
  isSelf: boolean;
  onToggleActive: () => void;
  onRoleChange: (role: AdminRole) => void;
  onRevoke: () => void;
  busy: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
        {member.name.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
          {member.name}
          {isSelf && <Pill tone="indigo">You</Pill>}
          {!member.isActive && <Pill tone="red">Deactivated</Pill>}
          {member.twoFactorEnabled ? (
            <span title="Two-factor enabled">
              <ShieldCheck className="size-3.5 text-emerald-700" />
            </span>
          ) : (
            <Pill tone="amber">2FA not set up</Pill>
          )}
        </p>
        <p className="truncate text-[12px] text-slate-500">
          {member.email} ·{' '}
          {member.lastLoginAt ? `last seen ${timeAgo(member.lastLoginAt)}` : 'never signed in'} ·
          added {formatDate(member.createdAt)}
        </p>
      </div>

      <select
        value={member.role}
        disabled={isSelf || busy}
        onChange={(e) => onRoleChange(e.target.value as AdminRole)}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12.5px] text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        title={isSelf ? 'You cannot change your own role' : 'Change role'}
      >
        {roles.map((r) => (
          <option key={r.value} value={r.value}>
            {roleLabel(r.value)}
          </option>
        ))}
      </select>

      {member.activeSessions > 0 && (
        <button
          onClick={onRevoke}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          title="Sign out of every device"
        >
          <KeyRound className="size-3.5" /> {member.activeSessions}
        </button>
      )}

      <Button
        variant={member.isActive ? 'secondary' : 'primary'}
        size="sm"
        disabled={isSelf || busy}
        onClick={onToggleActive}
        title={isSelf ? 'You cannot deactivate yourself' : undefined}
      >
        {member.isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
    </li>
  );
}
