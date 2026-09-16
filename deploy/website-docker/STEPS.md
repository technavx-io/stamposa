# Getting stamposa.com live — CloudStick + Docker

Scope: the public site plus the portal pages, served by one Next.js container
on 127.0.0.1:3000, with CloudStick's nginx terminating HTTPS in front of it.
The API, Postgres and Redis are **not** in this stack — the site renders, but
anything requiring a login will not work until the API is deployed. Expected
at this stage.

Verified on 2026-09-01:
- DNS: stamposa.com, app.stamposa.com, api.stamposa.com → 192.210.152.199
- CloudStick is installed; nginx/1.26.2 answers on port 80
- http://stamposa.com returns 200 (CloudStick's placeholder page)
- Port 443 closed (no certificate yet), port 3000 closed (no app yet)
- The bundle boots locally and serves the home page in 69ms

Why no Caddy: CloudStick's nginx owns ports 80 and 443. Two web servers cannot
share them. CloudStick terminates TLS and proxies to the container instead.
(`Caddyfile.unused-cloudstick` is kept only for the non-CloudStick setup.)

---

## Step 1 — Create the site in CloudStick

Create New Website → **Proxy App** ("JavaScript runtime for server-side
applications", No PHP). Not WordPress, Custom PHP, Laravel or any other entry
— those are all PHP stacks.

    Domain: stamposa.com
    Port:   3000

Leave SSL until Step 5; the app should answer first.

## Step 2 — SSH access

Install this public key for root, from the RackNerd VNC console or CloudStick's
own terminal if it offers one:

    mkdir -p ~/.ssh && chmod 700 ~/.ssh
    echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJbJ4WUKme5pf4J4Ay7lm21vshsLPlJBP6bIkHgAflpt technavx@gmail.com' >> ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys

Confirm from the Mac:

    ssh root@192.210.152.199 'echo OK'

Note: the server's SSH host key has changed twice during the rebuilds. Verify
it before accepting — on the server run
`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` and compare with what your
Mac reports on first connect.

## Step 3 — Install Docker (on the server, as root)

    apt-get update
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

No firewall changes needed: the container binds to 127.0.0.1 only, and
CloudStick already manages ports 80/443.

## Step 4 — Upload and start the app

From the Mac:

    cd "/Volumes/Acestar & swatnimh/Loyalty Card/loyalty-platform/deploy"
    scp stamposa-web-docker.tar.gz root@192.210.152.199:/opt/

On the server:

    cd /opt && tar xzf stamposa-web-docker.tar.gz && cd website-docker
    docker compose up -d --build

Confirm the app answers locally before involving nginx:

    curl -I http://127.0.0.1:3000

Expect `HTTP/1.1 200 OK`. If that fails, `docker compose logs web`.

Then through nginx:

    curl -I http://stamposa.com

Expect 200 and the Stamposa page rather than CloudStick's placeholder.

## Step 5 — Enable SSL

In CloudStick, open the stamposa.com site and issue a Let's Encrypt
certificate. DNS already resolves, so validation should pass immediately.

Verify from the Mac:

    curl -I https://stamposa.com

Expect `HTTP/2 200`. Port 443 should now be open.

---

## Everyday operations

| Task | Command (in /opt/website-docker) |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f web` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` |
| Deploy a new build | replace `frontend/`, then `docker compose up -d --build` |

## If something fails

- **502 Bad Gateway from nginx** — the container is down or on the wrong port.
  Check `docker compose ps` and `curl -I http://127.0.0.1:3000`.
- **CloudStick placeholder still showing** — the Proxy App site is pointing
  somewhere other than port 3000, or nginx needs a reload.
- **Certificate will not issue** — confirm `dig +short stamposa.com` returns
  192.210.152.199 and that port 80 stays reachable during validation.
- **Portal logins fail** — expected. The API is not deployed yet.

## Still outstanding after this

The website is only the first slice. Also pending: the API (needs Postgres +
Redis on a 2GB box — plan carefully), app.stamposa.com and api.stamposa.com
sites in CloudStick, MSG91 + DLT approval for OTP SMS, SMTP credentials,
Apple/Google wallet certificates, and disabling SSH password login once the
key works.
