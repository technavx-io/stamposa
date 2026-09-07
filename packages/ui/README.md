# @stamposa/ui

The design system and browser utilities that the **website** (`apps/website`)
and the **app** (`apps/frontend`) share. Plain TypeScript source, no build
step: both Next.js apps list it in `transpilePackages` and map
`@stamposa/ui/*` to `src/*` in their `tsconfig.json`.

```
src/
  styles/theme.css      Tailwind v4 tokens: brand ramp, surfaces, dark mode, fonts
  lib/theme.tsx         ThemeProvider + the pre-paint theme script
  lib/hosts.ts          Which paths live on stamposa.com vs app.stamposa.com; appHref/siteHref
  lib/utils.ts          cn(), date/phone/price formatters
  lib/version.ts        Build stamp exposed at /version in both apps
  components/button.tsx
  components/theme-toggle.tsx
  components/plan-grid.tsx   Pricing grid (marketing /pricing and merchant billing)
  components/monitoring.tsx  Sentry browser loader + reportError
  types/plans.ts        Plan shapes shared with the API's public plans endpoint
```

Rules of thumb:

- Something belongs here only if **both** apps use it. Portal-only widgets stay
  in `apps/frontend/src/components`; marketing-only pieces stay in
  `apps/website/src/components/marketing`.
- Each app imports `styles/theme.css` from its own `globals.css` and adds a
  Tailwind `@source` for this package so the utility classes used in these
  components are generated.
- Fonts are declared per app with `next/font` (they cannot be shared), using
  the same three variable names the theme expects.
