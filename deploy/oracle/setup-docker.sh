#!/usr/bin/env bash
# Optional: PostGIS + PgBouncer in Docker instead of Ubuntu packages.
# On Ampere (aarch64), prefer ./setup-vm.sh — official postgis images are often amd64-only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Do not run as root. Use the ubuntu user with sudo."
  exit 1
fi

if [[ ! -f .env ]]; then
  cp env.example .env
  PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${PASS}/" .env
  echo "Wrote deploy/oracle/.env with a generated password. Save it — you need it for Vercel."
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker…"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Log out and back in (or run: newgrp docker), then re-run this script."
  exit 0
fi

echo "Starting PostGIS + PgBouncer…"
docker compose pull
docker compose up -d

if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -qi 'Status: active'; then
  sudo ufw allow OpenSSH
  sudo ufw allow 5432/tcp
  sudo ufw allow 6543/tcp
fi
sudo iptables -C INPUT -p tcp --dport 5432 -j ACCEPT 2>/dev/null \
  || sudo iptables -I INPUT -p tcp --dport 5432 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 6543 -j ACCEPT 2>/dev/null \
  || sudo iptables -I INPUT -p tcp --dport 6543 -j ACCEPT
if [[ -d /etc/iptables ]]; then
  sudo sh -c 'iptables-save > /etc/iptables/rules.v4' || true
fi

# shellcheck disable=SC1091
source .env
PUBLIC_IP="$(curl -fsS --max-time 8 https://ifconfig.me || hostname -I | awk '{print $1}')"

echo
echo "Database is up."
echo
echo "  DATABASE_URL=\"postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${PUBLIC_IP}:${PGBOUNCER_PORT:-6543}/${POSTGRES_DB}?schema=public&pgbouncer=true&connection_limit=1&sslmode=disable\""
echo "  DIRECT_URL=\"postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${PUBLIC_IP}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}?schema=public&sslmode=disable\""
echo
echo "Open TCP 5432 and 6543 on the OCI subnet security list (source 0.0.0.0/0)."
