'use client';

import { createContext, useContext } from 'react';
import type { Business, Me } from '../api/types';

export interface MerchantContextValue {
  me: Me;
  /** Guaranteed by the portal guard — merchants without one are onboarding. */
  business: Business;
  refresh: () => Promise<unknown>;
}

export const MerchantContext = createContext<MerchantContextValue | null>(null);

export function useMerchant(): MerchantContextValue {
  const ctx = useContext(MerchantContext);
  if (!ctx) throw new Error('useMerchant must be used inside the merchant portal layout');
  return ctx;
}
