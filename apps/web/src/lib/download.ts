'use client';

import { API_URL } from './api/client';
import { customerSession, merchantSession } from './auth/session';

/**
 * Downloads an authenticated file. A plain anchor can't carry the bearer
 * token, so fetch it, then hand the browser a blob URL.
 */
export async function downloadAuthenticated(
  path: string,
  fallbackName: string,
  opts?: { session?: 'merchant' | 'customer' },
): Promise<void> {
  const store = opts?.session === 'customer' ? customerSession : merchantSession;
  const token = store.get()?.tokens.accessToken;
  const res = await fetch(`${API_URL}/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
