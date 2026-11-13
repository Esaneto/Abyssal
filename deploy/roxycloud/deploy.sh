#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || { echo "Execute como root."; exit 1; }
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
exec 9>/run/lock/abyssal-deploy.lock
flock -n 9 || exit 0
cd /opt/abyssal
as_app() { runuser -u abyssal -- "$@"; }
previous=$(as_app git rev-parse HEAD)
as_app git fetch --prune origin main
target=$(as_app git rev-parse origin/main)
[[ "$previous" != "$target" ]] || { echo "Abyssal atualizado."; exit 0; }
stage=$(mktemp -d /opt/abyssal-stage.XXXXXX)
chown abyssal:abyssal "$stage"
cleanup() { as_app git worktree remove --force "$stage" >/dev/null 2>&1 || true; rm -rf -- "$stage"; }
trap cleanup EXIT
as_app git worktree add --detach "$stage" "$target"
(
 cd "$stage"
 as_app npm ci --omit=dev
 as_app node --check server.js
 as_app node --check payments.js
 as_app node --check public/game.js
 as_app node --test tests/roxycloud-readiness.test.cjs tests/roxycloud-stripe-webhook.test.cjs tests/specimen-journal-biology.test.cjs tests/submarine-repair-performance.test.cjs tests/native-update.test.cjs tests/browser-auto-update.test.cjs
)
# SIGTERM checkpoints online runs before disconnect; validated updates may run during gameplay.
if ! curl -fsS --max-time 5 http://127.0.0.1:3000/health | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const h=JSON.parse(s);process.exit(h.ok&&h.persistence==="postgres"&&h.resources?.profile==="roxycloud-ryzen4"?0:1)}catch{process.exit(1)}})'; then
 echo "Deploy adiado: health ou perfil de persistência indisponível."; exit 0
fi
health() {
 for i in {1..45}; do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/health 2>/dev/null | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{const h=JSON.parse(s);process.exit(h.ok&&h.persistence==="postgres"&&h.resources?.profile==="roxycloud-ryzen4"?0:1)}catch{process.exit(1)}})'; then return 0; fi
  sleep 1
 done
 return 1
}
rollback() {
 trap - ERR
 echo "Falha; restaurando código anterior $previous" >&2
 systemctl stop abyssal || true
 as_app git checkout --detach "$previous" && as_app npm ci --omit=dev && systemctl start abyssal && health || { echo "Rollback requer intervenção." >&2; exit 2; }
 exit 1
}
trap rollback ERR
systemctl stop abyssal
as_app git checkout --detach "$target"
as_app npm ci --omit=dev
systemctl start abyssal
health
# Allow browsers to keep JS/CSS locally while still revalidating every launch.
# Patch only the cache header so Certbot-managed TLS directives stay untouched.
nginx_site=/etc/nginx/sites-available/abyssal
if [[ -f "$nginx_site" ]] && grep -q 'Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate"' "$nginx_site"; then
 nginx_backup=$(mktemp)
 cp "$nginx_site" "$nginx_backup"
 sed -i 's/Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate"/Cache-Control "public, no-cache, must-revalidate"/' "$nginx_site"
 if /usr/sbin/nginx -t; then
  systemctl reload nginx
 else
  cp "$nginx_backup" "$nginx_site"
  /usr/sbin/nginx -t || true
 fi
 rm -f "$nginx_backup"
fi
trap - ERR
echo "Deploy concluído: $target"
