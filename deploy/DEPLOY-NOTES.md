# Stamposa — production deploy kit

Everything is compiled on the Mac and shipped to the VPS as tarballs. Nothing
is built on the server. The full procedure, with verification and rollback,
is in the deploy runbook (Claude artifact "Stamposa Deploy Runbook").

```
build-bundles.sh              one command: builds all three apps, stamps them, writes the tarballs
website-docker/               -> /opt/website-docker on the server (compose project stamposa-web)
  Dockerfile.website            image for stamposa.com      (bundle in website/)
  Dockerfile.frontend           image for app.stamposa.com  (bundle in frontend/)
  docker-compose.yml            services web :3000 and web-app :3001, host networking
api-docker/                   -> /opt/api-docker on the server (compose project stamposa-api)
  Dockerfile                    installs prod deps + prisma generate around the shipped dist/
  docker-compose.yml            api :4000, postgres, redis — host networking, bind mounts
  build-info.env                version stamp written by build-bundles.sh (read after .env)
stamposa-web-docker.tar.gz    upload to /opt/, extract, `docker compose up -d --build`
stamposa-api-docker.tar.gz    upload to /opt/, extract, build, migrate, `docker compose up -d`
```

Quick path for a release:

```bash
bash build-bundles.sh
scp stamposa-web-docker.tar.gz stamposa-api-docker.tar.gz root@192.210.152.199:/opt/
```

Then on the server, web first:

```bash
cd /opt && tar czf website-docker-prev-$(date +%Y%m%d%H%M).tar.gz website-docker/website website-docker/frontend 2>/dev/null || true
tar xzf stamposa-web-docker.tar.gz -C /opt && cd website-docker && docker compose up -d --build
```

And the API only when the backend changed:

```bash
cd /opt && tar xzf stamposa-api-docker.tar.gz -C /opt && cd api-docker
docker compose build api
docker compose run --rm api npx prisma migrate deploy    # only if the release has migrations
docker compose up -d
```

Verify: `/version` on both web hosts and `/v1/health` on the API must all
report the commit that `build-bundles.sh` printed.

Historical note: an earlier `deploy/` folder in the monorepo used a
different (build-on-server) approach and took the API down on 7 Sep 2026.
It was removed and replaced by this kit. If you find any old references
pointing at an earlier `deploy.sh`, ignore them — this directory is the
current source of truth.
