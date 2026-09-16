# @stamposa/api-client

Typed transport for the Stamposa API. **Types are generated from the
backend's OpenAPI spec.** Do not hand-maintain anything under `src/`.

## Regenerating

From the repo root:

```
npm run api-client:generate
```

That runs two steps under the hood:

1. `npm run openapi:emit -w apps/backend` — boots the Nest app in a
   context-only mode, calls `SwaggerModule.createDocument()`, and writes
   `packages/api-client/openapi.json`.
2. `npm run generate -w packages/api-client` — runs `openapi-typescript`
   over that JSON and writes `packages/api-client/src/schema.ts`.

Both `openapi.json` and `schema.ts` are checked in so the frontend can
build in CI without booting the backend.

## Using

```ts
import { createApiClient, type ApiSchemas } from '@stamposa/api-client';

const api = createApiClient({ baseUrl: 'https://api.stamposa.com/v1' });

// Typed. `data` is `ApiSchemas['HealthDto']`.
const { data, error } = await api.GET('/health');

// Send a bearer token per request.
const authed = createApiClient({
  baseUrl: 'https://api.stamposa.com/v1',
  headers: () => ({ Authorization: `Bearer ${getAccessToken()}` }),
});
```

## What this package does NOT do

- **Refresh logic.** The frontend's existing `ApiClient` handles 401 →
  refresh → replay. Keep that — this package is a typed transport, not a
  session manager.
- **Error normalization.** `ApiError` stays in the frontend.
- **State.** No caching, no tanstack-query hooks. Use it as a fetch client
  or wrap it in the query key of your choice.
