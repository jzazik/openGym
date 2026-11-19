# Firebat deployment

This instance uses the official DuarteSantos8/openGym release **v1.4.4**. The API uses the
published release image. The web image adds the instance's dog mascots and illustrated equipment picker using the source-build
scenario in [SELF_HOSTING.md](SELF_HOSTING.md).

## Local preview without Docker

Use Node.js 22.12 or newer. With nvm, run `nvm use` from the repository root.

```bash
cp .env.example .env
npm ci --prefix api --omit=optional
npm ci --prefix frontend --ignore-scripts
bash scripts/start-local.sh
```

Open http://localhost:8080. The launcher builds the frontend, stages the repository's
exercise media and starts the API and preview on loopback only. It checks ports 3000 and
8080 before starting. Ctrl+C stops both services. Local data stays in `data/`.
Keep `.env` set to `RP_ID=localhost`, `ORIGIN=http://localhost:8080`, `WEB_PORT=8080`.
The production preview supports the service worker on localhost; the development server
does not register one. Use Docker and HTTPS for the public server.

## Server configuration

Deployment directory: `/var/www/opengym`. Private server `.env`:

```dotenv
RP_ID=gym.jzazik.com
ORIGIN=https://gym.jzazik.com
WEB_PORT=127.0.0.1:18086
RP_NAME=openGym
```

```bash
cd /var/www/opengym
docker compose -f docker-compose.yml -f compose.production.yml config --quiet
docker compose -f docker-compose.yml -f compose.production.yml pull
docker compose -f docker-compose.yml -f compose.production.yml up -d --no-build
curl --fail http://127.0.0.1:18086/api/health
```

`compose.production.yml` pins both images to 1.4.4. The server checkout may use sparse
checkout for configuration and documentation because prebuilt images already contain the
application and exercise media. A source build requires a full checkout.

## Custom web image

Use a full source snapshot of v1.4.4 with the reviewed frontend changes, including
`catalogue/media/`. Keep each snapshot in its own release directory, for example
`/var/www/opengym/releases/1.4.4-routine-equipment-v1`, without `.env`, `data/`, `.git` or `node_modules/`.
Copy `compose.branding.yml` from that snapshot to the deployment directory. The existing
configuration-only checkout and the running containers are not edited to build the frontend.

Build and validate before switching the web container:

```bash
cd /var/www/opengym
export OPENGYM_SOURCE_DIR=/var/www/opengym/releases/1.4.4-routine-equipment-v1
docker compose -f docker-compose.yml -f compose.production.yml -f compose.branding.yml config --quiet
docker compose -f docker-compose.yml -f compose.production.yml -f compose.branding.yml build web
mkdir -p backups
chmod 700 backups
tar czf backups/opengym-before-routine-equipment-v1.tar.gz data/
chmod 600 backups/opengym-before-routine-equipment-v1.tar.gz
docker compose -f docker-compose.yml -f compose.production.yml -f compose.branding.yml up -d --no-build --no-deps web
curl --fail http://127.0.0.1:18086/api/health
```

The API image and data mount stay the same. Keep the source snapshot and custom image for
rebuilding and rollback. Increment the custom tag and release directory for later changes.
To restore the official web image, omit the branding override:

```bash
docker compose -f docker-compose.yml -f compose.production.yml up -d --no-build --no-deps web
```

The primary icon and favicon use the strong dog. Home switches to the seated dog after seven
calendar days since the latest logged workout, and back after a new workout. A new profile
starts with the strong dog. Both images are cached for offline use. The installed PWA icon
stays the strong dog; the browser controls updates to an existing home-screen icon.

The Coach questionnaire and Settings → Equipment profile editor share illustrated equipment
cards with Russian names and English subtitles. All 37 equipment types and accessories in the
profile editor have illustrations. The equipment identifiers stored in profiles stay unchanged.
The images are cached for offline use with the application shell.

Home has an equipment-profile selector. Routine editors can assign a profile tag; untagged
routines match their exercise equipment automatically. Suggestions require all exercise
equipment and accessories to be available, and any assigned profile must match the selected
profile. All equipment disables profile filtering. Incompatible routines stay editable in
Plan; filtering does not remove them from the saved schedule, queue or workout history.
The selected profile and routine tags use the existing state persistence and synchronization.

## DNS and HTTPS

Set the `gym` DNS A record in `jzazik.com` to `95.84.228.243`, DNS-only. The host nginx
HTTP vhost serves ACME challenges from `/var/www/letsencrypt` and redirects other requests
to HTTPS. Issue the certificate after DNS resolves:

```bash
certbot certonly --webroot -w /var/www/letsencrypt -d gym.jzazik.com
```

Firebat's existing SNI router owns port 443. The HTTPS vhost listens on
`127.0.0.1:8443 ssl proxy_protocol`, uses the certificate under
`/etc/letsencrypt/live/gym.jzazik.com/` and proxies to `http://127.0.0.1:18086`.
Preserve `Host` and set `X-Forwarded-Proto https`. Allow 48 MiB request bodies for custom
exercise uploads. Run `nginx -t` before reloading nginx. Certificate renewal must reload
nginx through a deploy hook.

Verify public HTTPS for `/api/health`, `/manifest.json`, `/sw.js` and the manifest icons.
On iPhone, use Safari's Share menu to add the final HTTPS address to the Home Screen.
On Android, use the browser's Install app or Add to Home screen action.
Create the real profile on the final domain; localhost passkeys are tied to localhost.

## Updates and backups

Back up `data/` before updates, as described in [SELF_HOSTING.md](SELF_HOSTING.md#6-backups).
For stock images, choose an official release, update both pinned image tags, pull and recreate
the services. For custom branding, rebuild the web image from the new release with the reviewed
branding changes using the custom-web-image procedure above.
Keep `RP_ID` stable. Never change source files inside a running container.
