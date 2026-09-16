/**
 * @stamposa/api-client
 *
 * A thin, fully-typed client for the Stamposa API. The `paths` and
 * `components` types come from the backend's OpenAPI spec (regenerate with
 * `npm run api-client:generate` at the repo root).
 *
 * Usage:
 *
 *   import { createApiClient } from '@stamposa/api-client';
 *
 *   const api = createApiClient({ baseUrl: 'https://api.stamposa.com/v1' });
 *   const { data, error } = await api.GET('/health');
 *
 * The `data` and `error` types are inferred from the OpenAPI spec, so
 * changing a response DTO in the backend surfaces as a TS error here.
 */
import createClient, { type Client, type ClientOptions } from 'openapi-fetch';
import type { paths, components, operations } from './schema';

export type { paths, components, operations };

/**
 * Convenience aliases so consumers can write
 * `ApiSchemas['MerchantDto']` instead of
 * `components['schemas']['MerchantDto']`.
 */
export type ApiSchemas = components extends { schemas: infer S } ? S : Record<string, unknown>;

/** The typed client instance returned by createApiClient. */
export type StamposaClient = Client<paths>;

/**
 * Factory. Consumers set baseUrl (usually the /v1 origin) and optionally a
 * headers function so the client can attach the current bearer token per
 * request. Everything else (retries, refresh, 401 recovery) stays in
 * consumer code — this package is purely a typed transport.
 */
export function createApiClient(options: ClientOptions): StamposaClient {
  return createClient<paths>(options);
}
