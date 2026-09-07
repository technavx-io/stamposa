# @stamposa/backend — the API (api.stamposa.com)

NestJS + Prisma + Redis. Serves the app (`apps/frontend`) and the public
plans endpoint the website's pricing page reads. Module-by-module design notes
are in `../../docs/ARCHITECTURE.md`; per-integration setup (SMS, wallets,
billing, monitoring) is in `../../docs/`.

```bash
cp .env.example .env               # first time only
npm run start:dev -w apps/backend  # http://localhost:4000, docs at /docs
npm run test -w apps/backend       # jest
npm run db:seed                    # from the repo root: wipes app tables, loads demo tenants
```

`dist/` is compiled here and shipped to the server by
`../../../stamposa-vps/build-bundles.sh`; the production image only installs
dependencies and runs `prisma generate` around it.
