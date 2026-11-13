#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || exit 1
umask 077
mkdir -p /root/abyssal-backups
chmod 700 /root/abyssal-backups
exec 9>/run/lock/abyssal-backup.lock
flock -n 9 || exit 0
set -a
source /etc/abyssal/abyssal.env
set +a
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL ausente" >&2; exit 1; }
# Pass connection details through child environment, never command line.
backup="/root/abyssal-backups/abyssal-auto-$(date -u +%Y%m%d-%H%M%S).dump"
tmp="$backup.part"
trap 'rm -f -- "$tmp"' EXIT
/usr/local/bin/node - "$tmp" <<'NODE'
const {spawnSync}=require('node:child_process');
const u=new URL(process.env.DATABASE_URL);
const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGSSLMODE:'verify-full',PGSSLROOTCERT:'/etc/ssl/certs/ca-certificates.crt'};
delete env.DATABASE_URL;
const r=spawnSync('/usr/lib/postgresql/18/bin/pg_dump',['--format=custom','--no-owner','--no-acl','--file',process.argv[2]],{env,stdio:'inherit'});
process.exit(r.status??1);
NODE
/usr/lib/postgresql/18/bin/pg_restore --list "$tmp" >/dev/null
mv "$tmp" "$backup"
sha256sum "$backup" > "$backup.sha256"
# Only delete automated copies older than 14 days, never manual backups.
find /root/abyssal-backups -maxdepth 1 -type f \( -name 'abyssal-auto-*.dump' -o -name 'abyssal-auto-*.dump.sha256' \) -mtime +14 -delete
echo "Backup concluído: $backup"
