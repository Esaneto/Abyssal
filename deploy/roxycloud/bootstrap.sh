#!/usr/bin/env bash
# First-stage provisioning for a fresh Ubuntu 24.04 RoxyCloud VPS.
# Does not start the game, touch DNS, change SSH/firewall, or copy secrets.
set -Eeuo pipefail
trap 'echo "[bootstrap] Erro na linha $LINENO. O servidor antigo não foi alterado." >&2' ERR
[[ $(id -u) -eq 0 ]] || { echo "Execute como root."; exit 1; }
. /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || { echo "Esperado Ubuntu 24.04."; exit 1; }
[[ $(nproc) -ge 2 ]] || { echo "Esperado pelo menos 2 vCPU."; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx xz-utils
case "$(uname -m)" in x86_64) arch=x64;; aarch64) arch=arm64;; *) echo "Arquitetura não suportada"; exit 1;; esac
# Install verified official Node 24 LTS distribution, outside the OS package tree.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
base=https://nodejs.org/dist/latest-v24.x
curl --proto '=https' --tlsv1.2 -fsSL "$base/SHASUMS256.txt" -o SHASUMS256.txt
archive=$(awk -v a="$arch" '$2 ~ ("^node-v24[.].*-linux-" a "[.]tar[.]xz$") {print $2; exit}' SHASUMS256.txt)
[[ -n "$archive" ]] || { echo "Node archive not found"; exit 1; }
curl --proto '=https' --tlsv1.2 -fsSL "$base/$archive" -o "$archive"
awk -v f="$archive" '$2==f' SHASUMS256.txt | sha256sum -c -
mkdir -p /opt/abyssal-node
tar -xJf "$archive" -C /opt/abyssal-node --strip-components=1
for bin in node npm npx; do ln -sfn "/opt/abyssal-node/bin/$bin" "/usr/local/bin/$bin"; done
export PATH=/usr/local/bin:$PATH
node --version
npm --version
id abyssal >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/abyssal --shell /usr/sbin/nologin abyssal
install -d -o abyssal -g abyssal -m 0755 /opt/abyssal
if [[ ! -d /opt/abyssal/.git ]]; then
  runuser -u abyssal -- git clone --branch main https://github.com/Esaneto/Abyssal.git /opt/abyssal
else
  echo "Checkout existente preservado; não será atualizado automaticamente."
fi
cd /opt/abyssal
runuser -u abyssal -- npm ci --omit=dev
node --check server.js
node --check public/game.js
node --test tests/roxycloud-readiness.test.cjs tests/specimen-journal-biology.test.cjs
install -d -o abyssal -g abyssal -m 0750 /opt/abyssal/data
install -d -o root -g root -m 0700 /etc/abyssal
if [[ ! -e /etc/abyssal/abyssal.env ]]; then
  install -m 0600 /dev/null /etc/abyssal/abyssal.env
  printf '%s\n' '# Configure os segredos do ambiente de produção antes de iniciar.' '# DATABASE_URL=' '# PUBLIC_BASE_URL=https://seu-dominio' >> /etc/abyssal/abyssal.env
fi
# Leave the service disabled until database and domain have been confirmed.
sed 's|ExecStart=/usr/bin/node |ExecStart=/usr/local/bin/node |' deploy/roxycloud/abyssal.service > /etc/systemd/system/abyssal.service
systemctl daemon-reload
install -m 0644 deploy/roxycloud/nginx-abyssal.conf /etc/abyssal/nginx-abyssal.template
nginx -t
ABYSSAL_RESOURCE_PROFILE=roxycloud-ryzen4 UV_THREADPOOL_SIZE=4 npm run preflight:roxycloud
echo "PREPARACAO_OK"
echo "Commit instalado: $(runuser -u abyssal -- git rev-parse HEAD)"
echo "Próxima etapa: configurar DATABASE_URL e domínio; serviço ainda não iniciado."
