#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || { echo "Execute como root."; exit 1; }
cd /opt/abyssal/deploy/roxycloud
install -o root -g root -m 0750 deploy.sh /usr/local/sbin/abyssal-deploy
install -o root -g root -m 0750 backup.sh /usr/local/sbin/abyssal-backup
cat >/etc/systemd/system/abyssal-auto-deploy.service <<'UNIT'
[Unit]
Description=Abyssal automatic validated deployment
After=network-online.target abyssal.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/abyssal-deploy
TimeoutStartSec=20min
Nice=10
UNIT
cat >/etc/systemd/system/abyssal-auto-deploy.timer <<'UNIT'
[Unit]
Description=Check Abyssal main every 10 minutes
[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
Unit=abyssal-auto-deploy.service
[Install]
WantedBy=timers.target
UNIT
cat >/etc/systemd/system/abyssal-backup.service <<'UNIT'
[Unit]
Description=Abyssal PostgreSQL backup
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/abyssal-backup
TimeoutStartSec=20min
Nice=10
UNIT
cat >/etc/systemd/system/abyssal-backup.timer <<'UNIT'
[Unit]
Description=Daily Abyssal database backup
[Timer]
OnCalendar=*-*-* 06:00:00 UTC
Persistent=true
Unit=abyssal-backup.service
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl start abyssal-backup.service
systemctl enable --now abyssal-backup.timer abyssal-auto-deploy.timer
systemctl list-timers --all 'abyssal-*'
echo "AUTOMACAO CONFIGURADA"
