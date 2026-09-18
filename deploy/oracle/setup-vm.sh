#!/usr/bin/env bash
# Run on the Oracle Cloud Ubuntu VM (Ampere aarch64).
# Installs PostgreSQL + PostGIS + PgBouncer from Ubuntu packages (no Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Do not run as root. Use the ubuntu user with sudo."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script expects Ubuntu (apt). Recreate the VM with Canonical Ubuntu aarch64."
  exit 1
fi

if [[ ! -f .env ]]; then
  cp env.example .env
  PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${PASS}/" .env
  echo "Wrote deploy/oracle/.env with a generated password. Save it — you need it for Vercel."
fi

# shellcheck disable=SC1091
source .env

if [[ -z "${POSTGRES_USER:-}" || -z "${POSTGRES_PASSWORD:-}" || -z "${POSTGRES_DB:-}" ]]; then
  echo ".env must set POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB."
  exit 1
fi

echo "Installing PostgreSQL, PostGIS, and PgBouncer…"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  postgresql \
  postgresql-contrib \
  postgis \
  pgbouncer \
  curl \
  openssl

PG_VER="$(pg_lsclusters --no-header | awk '{print $1}' | head -1)"
PG_CLUSTER="$(pg_lsclusters --no-header | awk '{print $2}' | head -1)"
if [[ -z "${PG_VER}" || -z "${PG_CLUSTER}" ]]; then
  echo "No PostgreSQL cluster found after install."
  exit 1
fi
PG_CONF_DIR="/etc/postgresql/${PG_VER}/${PG_CLUSTER}"
echo "Using PostgreSQL ${PG_VER} cluster ${PG_CLUSTER}."

echo "Creating role and database…"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'" | grep -qx 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 --set=pass="${POSTGRES_PASSWORD}" \
    -c "ALTER USER \"${POSTGRES_USER}\" WITH PASSWORD :'pass';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 --set=pass="${POSTGRES_PASSWORD}" \
    -c "CREATE USER \"${POSTGRES_USER}\" WITH PASSWORD :'pass';"
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'" | grep -qx 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${POSTGRES_DB}" <<SQL
CREATE EXTENSION IF NOT EXISTS postgis;
GRANT ALL ON SCHEMA public TO "${POSTGRES_USER}";
GRANT SELECT ON spatial_ref_sys TO "${POSTGRES_USER}";
SQL

sudo mkdir -p "${PG_CONF_DIR}/conf.d"
sudo tee "${PG_CONF_DIR}/conf.d/minearchive.conf" >/dev/null <<EOF
listen_addresses = '*'
max_connections = 100
shared_buffers = 256MB
password_encryption = scram-sha-256
EOF

HBA="${PG_CONF_DIR}/pg_hba.conf"
if ! sudo grep -q "minearchive-oracle" "${HBA}"; then
  sudo tee -a "${HBA}" >/dev/null <<EOF

# minearchive-oracle
host    ${POSTGRES_DB}    ${POSTGRES_USER}    127.0.0.1/32    scram-sha-256
host    ${POSTGRES_DB}    ${POSTGRES_USER}    0.0.0.0/0       scram-sha-256
host    ${POSTGRES_DB}    ${POSTGRES_USER}    ::/0            scram-sha-256
EOF
fi

echo "Configuring PgBouncer (transaction pool on ${PGBOUNCER_PORT:-6543})…"
MD5_HEX="$(printf '%s' "${POSTGRES_PASSWORD}${POSTGRES_USER}" | md5sum | awk '{print $1}')"
sudo tee /etc/pgbouncer/userlist.txt >/dev/null <<EOF
"${POSTGRES_USER}" "md5${MD5_HEX}"
EOF
sudo chown postgres:postgres /etc/pgbouncer/userlist.txt 2>/dev/null \
  || sudo chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt
sudo chmod 640 /etc/pgbouncer/userlist.txt

sudo cp -n /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini.orig 2>/dev/null || true
sudo tee /etc/pgbouncer/pgbouncer.ini >/dev/null <<EOF
[databases]
${POSTGRES_DB} = host=127.0.0.1 port=5432 dbname=${POSTGRES_DB} user=${POSTGRES_USER} password=${POSTGRES_PASSWORD}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = ${PGBOUNCER_PORT:-6543}
unix_socket_dir = /var/run/postgresql
pidfile = /var/run/postgresql/pgbouncer.pid
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 200
default_pool_size = 20
ignore_startup_parameters = extra_float_digits,options
admin_users = postgres
client_tls_sslmode = disable
server_tls_sslmode = disable
EOF

if [[ -f /etc/default/pgbouncer ]]; then
  sudo sed -i 's/^START=.*/START=1/' /etc/default/pgbouncer
  grep -q '^START=' /etc/default/pgbouncer || echo 'START=1' | sudo tee -a /etc/default/pgbouncer >/dev/null
fi

sudo systemctl enable postgresql pgbouncer
sudo systemctl restart postgresql
sudo systemctl restart pgbouncer

echo "Opening host firewall for 5432 and 6543 (does not replace the OCI security list)…"
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

echo "Checking PostGIS and PgBouncer…"
sudo -u postgres psql -d "${POSTGRES_DB}" -c "SELECT PostGIS_Version();"
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h 127.0.0.1 -p "${PGBOUNCER_PORT:-6543}" \
  -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  -c "SELECT 1 AS pgbouncer_ok;"

PUBLIC_IP="$(curl -fsS --max-time 8 https://ifconfig.me || hostname -I | awk '{print $1}')"

echo
echo "Database is up."
echo
echo "Vercel / .env.local (HOST is the VM public IPv4):"
echo
echo "  DATABASE_URL=\"postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${PUBLIC_IP}:${PGBOUNCER_PORT:-6543}/${POSTGRES_DB}?schema=public&pgbouncer=true&connection_limit=1&sslmode=disable\""
echo "  DIRECT_URL=\"postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${PUBLIC_IP}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}?schema=public&sslmode=disable\""
echo
echo "Then from your laptop, with those vars in .env.local:"
echo "  npx prisma db push"
echo "  node scripts/seed-demo-users.mjs"
echo
echo "Also allow TCP 5432 and 6543 from 0.0.0.0/0 on the OCI subnet security list."
