/**
 * Offline OpenAPI dumper.
 *
 * Boots the Nest app just enough to run SwaggerModule.createDocument()
 * without listening on a port, then writes the JSON to
 * ../../packages/api-client/openapi.json.
 *
 * Dummy env values are provided so the strict env schema in src/config/env.ts
 * accepts the boot. The app never opens a DB or Redis connection because it
 * never handles a request; Prisma and ioredis both connect lazily.
 *
 * Run:
 *   npm run openapi:emit -w apps/backend
 * or via the repo-root wrapper:
 *   npm run api-client:generate
 */

/* eslint-disable @typescript-eslint/no-var-requires */
// Dummy env for schema validation — this process never handles traffic.
process.env.NODE_ENV ??= 'development';
process.env.DATABASE_URL ??=
  'postgresql://loyalty:codegen@127.0.0.1:5432/loyalty_platform?schema=public';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.JWT_ACCESS_SECRET ??= 'x'.repeat(64);
process.env.JWT_REFRESH_SECRET ??= 'y'.repeat(64);
process.env.WEB_APP_URL ??= 'http://localhost:3001';
process.env.API_PUBLIC_URL ??= 'http://localhost:4000';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
process.env.ADMIN_REQUIRE_2FA ??= 'false';

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    bufferLogs: false,
  });
  app.setGlobalPrefix('v1');

  const config = new DocumentBuilder()
    .setTitle('Loyalty Platform API')
    .setDescription(
      'Multi-tenant loyalty platform — Phase 1. Bearer JWT auth; see /docs for the interactive UI.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  await app.close();

  const outPath = resolve(__dirname, '../../../packages/api-client/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  console.log(`✓ Wrote ${outPath} (${Object.keys(document.paths ?? {}).length} paths)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
