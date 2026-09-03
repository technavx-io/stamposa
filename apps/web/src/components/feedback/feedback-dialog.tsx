'use client';

import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MessageSquarePlus, Star } from 'lucide-react';
import type { FeedbackCategory, FeedbackInput } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { Modal } from '@/components/ui/modal';
import { Field } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const categories: { value: FeedbackCategory; label: string }[] = [
  { value: 'SUGGESTION', label: 'Suggestion' },
  { value: 'BUG', label: 'Something broke' },
  { value: 'PRAISE', label: 'Praise' },
  { value: 'OTHER', label: 'Other' },
];

const schema = z.object({
  category: z.enum(['SUGGESTION', 'BUG', 'PRAISE', 'OTHER']),
  message: z.string().trim().min(3, 'Tell us a little more.').max(2000, 'Please keep it under 2000 characters.'),
});
type FormValues = z.infer<typeof schema>;

export function FeedbackDialog({
  send,
  /** Optional custom trigger; falls back to a labelled button. */
  renderTrigger,
}: {
  send: (input: FeedbackInput) => Promise<{ id: string }>;
  renderTrigger?: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'SUGGESTION', message: '' },
  });

  const close = () => {
    setOpen(false);
    form.reset();
    setRating(0);
    setHover(0);
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      await send({
        category: values.category,
        message: values.message,
        rating: rating || undefined,
      });
      toast.success('Thanks — your feedback is in.');
      close();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not send feedback.');
    }
  });

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <MessageSquarePlus className="size-4" /> Send feedback
        </Button>
      )}

      <Modal
        open={open}
        onClose={close}
        title="Send feedback"
        description="Ideas, bugs, or just how it's going — this goes straight to the Stamposa team."
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="What's this about?">
            {(p) => (
              <div id={p.id} className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const active = form.watch('category') === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => form.setValue('category', c.value)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                        active
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-line bg-surface text-body hover:bg-surface-2',
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <Field label="Rating" optional>
            {(p) => (
              <div id={p.id} className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const n = i + 1;
                  const filled = (hover || rating) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      onClick={() => setRating(n === rating ? 0 : n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      className="p-0.5"
                    >
                      <Star
                        className={cn(
                          'size-6 transition-colors',
                          filled ? 'fill-amber-400 text-amber-400' : 'text-zinc-300',
                        )}
                      />
                    </button>
                  );
                })}
                {rating > 0 && (
                  <span className="ml-1.5 text-[13px] text-muted tabular-nums">{rating}/5</span>
                )}
              </div>
            )}
          </Field>

          <Field label="Your feedback" error={form.formState.errors.message?.message}>
            {(p) => (
              <textarea
                {...p}
                {...form.register('message')}
                rows={4}
                autoFocus
                placeholder="What's working, what isn't, what you'd love to see…"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-strong placeholder:text-muted focus:border-brand-500 focus:outline-2 focus:outline-brand-500/20"
              />
            )}
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" loading={form.formState.isSubmitting}>
              Send feedback
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
