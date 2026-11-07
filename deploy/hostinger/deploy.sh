#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${ABYSSAL_APP_DIR:-/opt/abyssal}"
BRANCH="${ABYSSAL_BRANCH:-main}"
HEALTH_URL="${ABYSSAL_HEALTH_URL:-http://127.0.0.1:3000/health}"

cd "$APP_DIR"
previous_commit="$(git rev-parse HEAD)"

rollback() {
  echo "[deploy] rollback para $previous_commit"
  git reset --hard "$previous_commit"
  npm ci --omit=dev
  sudo systemctl restart abyssal
}
trap 'echo "[deploy] falhou"; rollback' ERR

git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
npm ci --omit=dev
node --check server.js
node --check state-persistence-worker.js
npm test

sudo systemctl restart abyssal

for attempt in {1..30}; do
  if curl --fail --silent --show-error "$HEALTH_URL" >/tmp/abyssal-health.json; then
    node -e "const h=require('/tmp/abyssal-health.json');if(!h.ok)process.exit(1);console.log('[deploy] health ok',h.build,h.resources?.profile||'generic')"
    trap - ERR
    echo "[deploy] concluído em $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done

echo "[deploy] health check não respondeu"
exit 1
