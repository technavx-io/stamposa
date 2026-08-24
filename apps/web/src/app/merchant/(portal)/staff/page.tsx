'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Link2, UserPlus } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import type { StaffMember } from '@/lib/api/types';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Badge, EmptyState, Panel, Spinner } from '@/components/ui/surface';
import { LoadError } from '@/components/ui/load-error';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter their name').max(60),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['STAFF', 'MANAGER']),
});
type FormValues = z.infer<typeof schema>;

export default function StaffPage() {
  const [addOpen, setAddOpen] = useState(false);
  const staff = useQuery({ queryKey: ['merchant', 'staff'], queryFn: merchantApi.listStaff });

  return (
    <>
      <PageHeader
        title="Staff"
        description="Staff sign in with their email and add stamps at the counter."
        action={
          <Button variant="brand" onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4" /> Add staff
          </Button>
        }
      />

      <p className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted">
        <Link2 className="size-4 shrink-0 text-muted" />
        Staff console lives at&nbsp;
        <span className="font-mono text-body">{typeof window !== 'undefined' ? `${window.location.origin}/staff` : '/staff'}</span>
        &nbsp;— share it with your team.
      </p>

      <Panel>
        {staff.isPending ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : staff.isError ? (
          <LoadError className="border-0" error={staff.error} onRetry={() => void staff.refetch()} />
        ) : !staff.data || staff.data.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="size-6" />}
            title="No staff yet"
            description="Add your team so they can stamp cards. You can also stamp from any customer's page yourself."
            action={
              <Button variant="secondary" onClick={() => setAddOpen(true)}>
                Add your first staff member
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {staff.data.map((member) => (
              <StaffRow key={member.id} member={member} />
            ))}
          </ul>
        )}
      </Panel>

      <AddStaffModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function StaffRow({ member }: { member: StaffMember }) {
  const queryClient = useQueryClient();
  const setRole = useMutation({
    mutationFn: (role: 'STAFF' | 'MANAGER') => merchantApi.updateStaff(member.id, { role }),
    onSuccess: async (updated) => {
      toast.success(
        updated.role === 'MANAGER'
          ? `${updated.name} is now a manager — they see team stats and can undo any recent stamp.`
          : `${updated.name} is now regular staff.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'staff'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update the role.'),
  });
  const toggle = useMutation({
    mutationFn: () => merchantApi.updateStaff(member.id, { isActive: !member.isActive }),
    onSuccess: async (updated) => {
      toast.success(updated.isActive ? `${updated.name} reactivated` : `${updated.name} deactivated`);
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'staff'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update staff.'),
  });

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-body">
        {member.name[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium text-strong">
          {member.name}
          {member.role === 'MANAGER' && <Badge tone="brand">Manager</Badge>}
          {!member.isActive && <Badge tone="red">Deactivated</Badge>}
        </p>
        <p className="text-xs text-muted">
          {member.email} · {member.stampsIssued} stamp{member.stampsIssued === 1 ? '' : 's'} issued
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setRole.mutate(member.role === 'MANAGER' ? 'STAFF' : 'MANAGER')}
        loading={setRole.isPending}
      >
        {member.role === 'MANAGER' ? 'Make staff' : 'Make manager'}
      </Button>
      <Button
        variant={member.isActive ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => toggle.mutate()}
        loading={toggle.isPending}
      >
        {member.isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
    </li>
  );
}

function AddStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'STAFF' },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await merchantApi.createStaff(values);
      toast.success(`${values.name} added — they can sign in at /staff now`);
      form.reset();
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['merchant', 'staff'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add staff.');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a staff member"
      description="They sign in with this email and password. Share the password with them; they can use it right away."
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" error={form.formState.errors.name?.message}>
          {(p) => <Input {...p} placeholder="Ravi Kumar" {...form.register('name')} autoFocus />}
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" placeholder="ravi@yourshop.com" {...form.register('email')} />}
        </Field>
        <Field label="Initial password" error={form.formState.errors.password?.message}>
          {(p) => (
            <Input
              {...p}
              type="text"
              placeholder="At least 8 characters"
              {...form.register('password')}
            />
          )}
        </Field>
        <Field
          label="Role"
          hint="Managers see the team's day on the console and can undo any stamp within 15 minutes."
        >
          {(p) => (
            <select
              {...p}
              {...form.register('role')}
              className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-strong outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="STAFF">Staff — stamp, redeem, enrol</option>
              <option value="MANAGER">Manager — staff powers + team stats + undo</option>
            </select>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" loading={form.formState.isSubmitting}>
            Add staff member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
