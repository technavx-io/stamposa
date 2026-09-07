# @stamposa/website — the informational site (stamposa.com)

Landing page, guide, blog (with RSS feed and sitemap) and pricing. No sign-in,
no client-side API calls; the pricing page fetches the public plans list from
the backend at request time. Anything performable redirects to the app
(`apps/frontend`). The design system both share is `packages/ui`.

```bash
npm run dev -w apps/website      # http://localhost:3000
npm run build -w apps/website    # standalone output for the Docker image
```

Add a blog post by appending to `src/content/posts.tsx`; the index, post
pages, feed and sitemap all derive from that array.
