# Database hosting alternatives

MineArchive needs **PostgreSQL + PostGIS** (polygon storage). Hosts that are only MySQL, SQLite, or MongoDB will not work.

Supabase Free pauses after ~7 days of no traffic. That is a host pause, not an app bug.

## Best free / cheap options

| Option | Cost | PostGIS | Pauses? | Notes |
|--------|------|---------|---------|-------|
| **Local Docker** (already in this repo) | Free | Yes | No | Best for laptop/dev. `docker compose up db` |
| **[Neon](https://neon.tech)** | Free tier | Yes (`CREATE EXTENSION postgis`) | Compute can scale to zero | Best hosted free replacement. Pair with Vercel. |
| **[Aiven](https://aiven.io)** | Free hobby PG | Yes | No (while the plan exists) | One small Postgres. Limited size. |
| **[Render](https://render.com)** | Paid Postgres now | Yes | — | Free Postgres was removed. Fine if you can pay. |
| **[Railway](https://railway.app)** | ~$5 credit / month | Yes (template) | Stops when credit runs out | Easy UI, not forever-free. |
| **[Fly.io](https://fly.io/docs/postgres)** | Usage-based | Yes if you install it | — | You run the machine. |
| **Oracle Cloud Always Free** | Free VM | Yes (you install) | No | Ampere VM. Step-by-step: [oracle-cloud-postgis.md](oracle-cloud-postgis.md). Scripts in `deploy/oracle/`. |
| **AWS / GCP / Azure free credits** | Trial credit | Yes | When credit ends | Good for a few months, then paid. |
| **Supabase Pro** | Paid | Yes | No | Same project, no auto-pause. |

## Do not use for this app

Firebase, PlanetScale, Turso, MongoDB Atlas, Cockroach serverless — no PostGIS polygons.

## Fastest path off Supabase Free

1. **Dev:** keep using local Docker (no pause, no advisor noise).
2. **Prod, still free, least setup:** Neon → enable PostGIS → copy the connection string into Vercel `DATABASE_URL` and `DIRECT_URL` → `npm run db:supabase` (or `prisma db push`) → redeploy.
3. **Prod, still free, no pause / no scale-to-zero:** [Oracle Cloud Always Free](oracle-cloud-postgis.md) — you create an Ampere VM; `deploy/oracle/setup-vm.sh` installs PostGIS + PgBouncer.
4. **Prod, least hassle:** stay on Supabase and upgrade to Pro.

## Point MineArchive at a new host

In `.env.local` and Vercel env:

```bash
DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?schema=public"
DIRECT_URL="postgresql://USER:PASS@HOST:5432/DB?schema=public"
```

Then:

```bash
npm run db:supabase    # enables PostGIS + pushes tables
# or, if PostGIS is already on:
npx prisma db push
```

You do **not** need Supabase Auth, Storage, or the anon key. This app uses Prisma + a session cookie.

## Local Docker (no cloud)

```bash
docker compose up -d db
cp .env.example .env.local   # already points at localhost:5432
npx prisma db push
npm run dev
```
