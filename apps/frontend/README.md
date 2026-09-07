# @stamposa/frontend — the app (app.stamposa.com)

Everything a visitor *performs*: the merchant, staff and admin portals and the
customer surfaces (`/join/[slug]`, `/card/[id]`, `/my-cards`). The
informational pages live in `apps/website`; the design system both share is
`packages/ui`.

```bash
npm run dev -w apps/frontend     # http://localhost:3001 (needs the backend on :4000)
npm run build -w apps/frontend   # standalone output for the Docker image
```

`.env.development` points at the local backend and the local website; nothing
else is needed for development. Production values are baked in at build time
by `../../../stamposa-vps/build-bundles.sh`.
