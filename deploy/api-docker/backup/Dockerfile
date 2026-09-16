# Stamposa backup sidecar.
#
# One small alpine container running `crond` daily. Reads Postgres via the
# host network, streams `pg_dump -Fc` and a live Redis RDB through openssl
# AES-256-CBC encryption, then rcats the encrypted stream straight into
# Cloudflare R2 without ever touching local disk. Failure sends an email
# through msmtp using the same SMTP credentials the API uses.
#
# The image is tiny and pins nothing beyond the alpine channel — a rebuild
# picks up client-tool security patches on every deploy.
FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      ca-certificates \
      curl \
      dcron \
      msmtp \
      openssl \
      postgresql16-client \
      rclone \
      redis \
      tzdata

WORKDIR /app
COPY backup.sh restore.sh entrypoint.sh /usr/local/bin/
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/entrypoint.sh

# crond writes here; the healthcheck reads the last-success timestamp from it.
RUN mkdir -p /var/log/stamposa-backup && touch /var/log/stamposa-backup/backup.log

ENV TZ=Asia/Kolkata

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
