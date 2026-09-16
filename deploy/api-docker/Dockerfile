# Stamposa API — compiled elsewhere, installed here.
#
# `dist/` is built on the dev machine, so this image never runs a TypeScript
# compile. That matters: the target box has 2GB of RAM shared with Postgres,
# Redis and two Next.js processes, and a full `npm ci` + `nest build` is the
# one step likely to OOM and take the live site down with it.
#
# Debian slim rather than Alpine on purpose — Prisma's query engine and
# @node-rs/argon2 both ship glibc prebuilds, and musl has been a recurring
# source of "works locally, segfaults in prod" for exactly these two.
FROM node:22-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY app/package.json ./
COPY app/prisma ./prisma

# Production dependencies, plus the three dev tools the deploy itself needs:
# the Prisma CLI for `migrate deploy`, and ts-node/typescript so the admin
# bootstrap (prisma/seed-admins.ts) can run without a separate build step.
RUN npm install --omit=dev --no-audit --no-fund \
    && npm install --no-save --no-audit --no-fund prisma ts-node typescript \
    && npx prisma generate

COPY app/dist ./dist
COPY app/tsconfig.json ./
# Bundled brand assets (wallet program logo, Apple pass icons) served at /assets.
COPY app/assets ./assets

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
