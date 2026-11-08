#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${ABYSSAL_APP_DIR:-/opt/abyssal}"
BRANCH="${ABYSSAL_BRANCH:-main}"
HEALTH_URL="${ABYSSAL_HEALTH_URL:-http://127.0.0.1:3000/health}"
EXPECTED_PROFILE="roxycloud-ryzen4"

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
node --check scripts/roxycloud-preflight.cjs
node --check public/game.js
node --check public/specimen-system.js
# The full historical suite remains in GitHub CI. A production hot deploy must
# pass the Roxy-specific acceptance gates, not unrelated stale expectations.
node --test tests/roxycloud-readiness.test.cjs tests/specimen-journal-biology.test.cjs

sudo systemctl restart abyssal

for attempt in {1..30}; do
  if curl --fail --silent --show-error "$HEALTH_URL" >/tmp/abyssal-health.json; then
    node -e "const h=require('/tmp/abyssal-health.json');if(!h.ok||h.resources?.profile!=='$EXPECTED_PROFILE')process.exit(1);console.log('[deploy] health ok',h.build,h.resources.profile,h.resources.cpu,h.resources.memory)"
    trap - ERR
    echo "[deploy] concluído em $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 1
done

echo "[deploy] health check não respondeu com o perfil RoxyCloud esperado"
exit 1
