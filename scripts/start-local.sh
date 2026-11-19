#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error("Use Node.js 22.12 or newer (nvm use)."); process.exit(1); }'
test -f .env || cp .env.example .env
test -d api/node_modules || { echo 'Run npm ci --prefix api first.' >&2; exit 1; }
test -d frontend/node_modules || { echo 'Run npm ci --prefix frontend first.' >&2; exit 1; }
test -d catalogue/media/still && test -d catalogue/media/clip || { echo 'Exercise media is missing from the checkout.' >&2; exit 1; }

node --env-file=.env --input-type=module -e '
  if (process.env.RP_ID !== "localhost" || process.env.ORIGIN !== "http://localhost:8080" || process.env.WEB_PORT !== "8080") {
    console.error("Local launch requires RP_ID=localhost, ORIGIN=http://localhost:8080, WEB_PORT=8080 in .env.");
    process.exit(1);
  }
  const { createServer } = await import("node:net");
  for (const [port, host] of [[3000, "127.0.0.1"], [8080, "localhost"]]) {
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(port, host, () => server.close(resolve));
    });
  }
'

npm --prefix frontend run build
node scripts/catalogue/stage-media.mjs frontend/dist
pids=()
cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${pids[@]}"; do wait "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

HOST=127.0.0.1 PORT=3000 DATA_DIR="$PWD/data" node --env-file=.env api/server.js &
pids+=("$!")
API_TARGET=http://127.0.0.1:3000 node frontend/node_modules/vite/bin/vite.js preview frontend --host localhost --port 8080 --strictPort &
pids+=("$!")

echo 'openGym: http://localhost:8080 (Ctrl+C to stop)'
while true; do
  for pid in "${pids[@]}"; do
    kill -0 "$pid" 2>/dev/null || { echo 'A local service stopped.' >&2; exit 1; }
  done
  sleep 1
done
