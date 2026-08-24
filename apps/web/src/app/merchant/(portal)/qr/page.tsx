'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, Printer, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/api/client';
import { merchantApi } from '@/lib/api/endpoints';
import { merchantSession } from '@/lib/auth/session';
import { useMerchant } from '@/lib/auth/merchant-context';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, Panel, PanelHeader, Spinner } from '@/components/ui/surface';

export default function QrPage() {
  const { business } = useMerchant();
  const [copied, setCopied] = useState(false);

  const qr = useQuery({
    queryKey: ['merchant', 'qr'],
    queryFn: () => merchantApi.getQr(512),
    staleTime: Infinity,
  });

  const copyLink = async () => {
    await navigator.clipboard.writeText(qr.data?.joinUrl ?? business.joinUrl);
    setCopied(true);
    toast.success('Join link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const download = async () => {
    // Authenticated download → fetch as blob, then save.
    const res = await fetch(`${API_URL}/v1/merchant/business/qr.png?size=1024`, {
      headers: { Authorization: `Bearer ${merchantSession.get()?.tokens.accessToken ?? ''}` },
    });
    if (!res.ok) {
      toast.error('Could not download the QR code.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `join-qr-${business.slug}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Your join QR code"
        description="Print it, stick it at the counter — customers scan to get their loyalty card."
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="QR code" />
          <div className="flex flex-col items-center gap-5 p-6">
            {qr.isPending ? (
              <div className="flex size-64 items-center justify-center">
                <Spinner className="size-7" />
              </div>
            ) : qr.isError || !qr.data ? (
              <EmptyState title="Couldn't generate the QR" description="Refresh to try again." />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL from our API */}
                <img
                  src={qr.data.qrDataUrl}
                  alt={`QR code linking to ${qr.data.joinUrl}`}
                  className="size-64 rounded-2xl border border-line p-3"
                />
                <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
                  <ScanLine className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-body">
                    {qr.data.joinUrl}
                  </span>
                  <button
                    onClick={() => void copyLink()}
                    className="rounded-md p-1.5 text-muted transition-colors hover:bg-zinc-200 hover:text-body"
                    aria-label="Copy join link"
                  >
                    {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" onClick={() => void download()}>
                    <Download className="size-4" /> Download PNG
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    <Printer className="size-4" /> Print standee
                  </Button>
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="How it works at the counter" />
          <ol className="space-y-4 p-5 text-sm text-body">
            {[
              'Print the standee and place it where customers pay.',
              'Customers scan it, verify their phone with an OTP and instantly get their digital card.',
              'On every purchase, your staff searches the customer and adds a stamp — the card updates live on the customer’s phone.',
              'When the card is full, the reward unlocks and a fresh card starts automatically.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mx-5 mb-5 rounded-lg bg-canvas px-3 py-2 text-[13px] text-muted">
            Tip: testing on this machine? Open the join link in a second browser window — the
            customer flow works side-by-side with this dashboard.
          </p>
        </Panel>
      </div>

      {/* Print-only standee sheet */}
      {qr.data && (
        <div className="print-sheet hidden flex-col items-center justify-center gap-6 bg-surface p-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight">{business.name}</h1>
          <p className="text-xl text-body">Scan to join our loyalty program</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.data.qrDataUrl} alt="Join QR code" className="size-80" />
          <p className="text-lg text-muted">Collect stamps. Earn rewards. No app needed.</p>
          <p className="font-mono text-sm text-muted">{qr.data.joinUrl}</p>
        </div>
      )}
    </>
  );
}
