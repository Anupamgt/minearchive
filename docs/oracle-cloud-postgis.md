# Oracle Cloud Always Free — PostGIS for MineArchive

Run **Postgres + PostGIS** on a free Ampere VM. The website stays on Vercel. This does **not** pause after 7 days (unlike Supabase Free).

You create the VM in the Oracle console. This repo installs and configures the database.

---

## What you get

- Always Free **Ampere A1**: up to 4 OCPU + 24 GB RAM (one VM or split)
- 200 GB boot volume
- Scripts in `deploy/oracle/` (Ubuntu packages; Docker is optional)

Capacity in a region can be “out of host capacity”. Try another home region or a smaller shape (2 OCPU / 12 GB).

Do **not** use `VM.Standard.E2.1.Micro` (1 GB RAM). It is too small for Postgres + PostGIS.

---

## 1. Create the VM

1. Sign up at [cloud.oracle.com](https://www.oracle.com/cloud/free/) (credit card required; Always Free is not billed if you stay in free shapes).
2. **Compute → Instances → Create instance**
3. Image: **Canonical Ubuntu 22.04** or **24.04**, **aarch64**
4. Shape: **Ampere** → `VM.Standard.A1.Flex` → **2–4 OCPU**, **12–24 GB**
5. Networking: **assign a public IPv4**
6. Add your **SSH public key**
7. Create. Copy the **public IP**.

Optional but recommended: **Networking → Reserved public IPs** and attach it to the VNIC so the address does not change if the instance is stopped.

SSH:

```bash
ssh ubuntu@YOUR_PUBLIC_IP
```

(Oracle Linux uses `opc` and `dnf`. Recreate the instance with Ubuntu if you landed on Oracle Linux.)

---

## 2. Open ports (two places)

Postgres must be reachable from Vercel (changing IPs), so allow **5432** and **6543** from `0.0.0.0/0`. Use the **long random password** the setup script generates.

**A. OCI security list**

Networking → VCN → subnet → **Security Lists** → Ingress:

| Source | Protocol | Dest port |
|--------|----------|-----------|
| `0.0.0.0/0` | TCP | 22 (SSH, already there) |
| `0.0.0.0/0` | TCP | 5432 |
| `0.0.0.0/0` | TCP | 6543 |

**B. VM firewall** — `setup-vm.sh` opens these with `ufw` / iptables if needed. It does not replace the security list.

---

## 3. Install the database on the VM

Ubuntu packages (recommended on Ampere — native ARM, no Docker image arch issues):

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/Anupamgt/minearchive.git
cd minearchive/deploy/oracle
chmod +x setup-vm.sh
./setup-vm.sh
```

It writes `deploy/oracle/.env` with a generated password, enables PostGIS, starts PgBouncer on **6543**, and prints `DATABASE_URL` / `DIRECT_URL`.

Check:

```bash
sudo systemctl status postgresql pgbouncer --no-pager
sudo -u postgres psql -d minearchive_db -c "SELECT PostGIS_Version();"
```

Docker alternative (x86 VMs, or if the PostGIS image has an arm64 tag):

```bash
chmod +x setup-docker.sh
./setup-docker.sh
```

---

## 4. Point MineArchive at it

On your laptop **and** in Vercel → Project → Settings → Environment Variables (Production):

```bash
DATABASE_URL="postgresql://minearchive:PASSWORD@YOUR_PUBLIC_IP:6543/minearchive_db?schema=public&pgbouncer=true&connection_limit=1&sslmode=disable"
DIRECT_URL="postgresql://minearchive:PASSWORD@YOUR_PUBLIC_IP:5432/minearchive_db?schema=public&sslmode=disable"
```

Use the user/password from the VM `.env`. Keep `SESSION_SECRET` and Google OAuth as they are.

`sslmode=disable` is required: this stack does not terminate TLS. The password is the control. Do not reuse a short password.

From the repo on your laptop (with those two vars in `.env.local`):

```bash
npx prisma db push
node scripts/seed-demo-users.mjs   # optional demo logins
```

That also creates `UserSiteAssignment` if it is missing.

Redeploy Vercel (or push a commit) so the new env is picked up.

Smoke test: `https://minearchive.vercel.app/api/health?deep=1` → `"database":"ok"`.

---

## 5. Copy data from Supabase (optional)

If you still have a live Supabase project:

```bash
pg_dump "$OLD_DIRECT_URL" --no-owner --no-acl -Fc -f minearchive.dump
pg_restore --no-owner --no-acl -d "$DIRECT_URL" minearchive.dump
```

Or re-upload KMLs after `prisma db push`.

---

## Ops

```bash
sudo systemctl status postgresql pgbouncer
sudo journalctl -u pgbouncer -n 50
```

Backups (cron on the VM):

```bash
sudo -u postgres pg_dump minearchive_db | gzip > ~/backup-$(date +%F).sql.gz
```

Docker path:

```bash
cd ~/minearchive/deploy/oracle
docker compose ps
docker compose exec -T db pg_dump -U minearchive minearchive_db | gzip > ~/backup-$(date +%F).sql.gz
```

---

## If something fails

| Symptom | Fix |
|---------|-----|
| Out of host capacity | Other region, or 2 OCPU / 12 GB |
| `connection timed out` | Security list **and** host iptables/ufw for 5432/6543 |
| `password authentication failed` | Password in Vercel must match VM `.env` (URL-encode special characters) |
| Prisma migrate / `db push` fails via 6543 | Use **DIRECT_URL** (5432) only for push |
| `database: error` on Vercel | Redeploy after env change; confirm the public IP did not change (use a reserved public IP) |
| Docker `no matching manifest` on Ampere | Use `./setup-vm.sh` (Ubuntu packages), not Docker |
