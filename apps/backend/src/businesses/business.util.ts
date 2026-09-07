import { Business } from '@prisma/client';
import { notFound } from '../common/exceptions';

/**
 * Merchant endpoints that operate on tenant data must resolve the tenant from
 * the authenticated merchant — never from client input. This is the single
 * chokepoint that turns "merchant token" into "businessId".
 */
export function requireBusiness(business: Business | null | undefined): Business {
  if (!business) {
    throw notFound('BUSINESS_NOT_FOUND', 'Create your business profile first.');
  }
  return business;
}
