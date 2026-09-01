# MineArchive

**Mining Area Directory & Archive**

A web-based application for monitoring changes in mining areas through KML boundary file uploads, map visualization, and historical tracking.

Current release: **[v1.0.0](CHANGELOG.md#100--2026-08-25)**. History from the MVP onward is tagged and listed in [CHANGELOG.md](CHANGELOG.md).

```bash
git checkout v0.1.0   # original MVP
git checkout v0.4.0   # real multi-layer GIS
git checkout v1.0.0   # site names + file inspect card
```

| Version | When | What landed |
|---------|------|-------------|
| [0.1.0](CHANGELOG.md#010--2026-06-19) | 2026-06-19 | MVP |
| [0.2.0](CHANGELOG.md#020--2026-06-28) | 2026-06-28 | Backend, PostGIS, Leaflet map, first polish |
| [0.3.0](CHANGELOG.md#030--2026-08-08) | 2026-08-08 | Google OAuth, Supabase, Vercel |
| [0.4.0](CHANGELOG.md#040--2026-08-12) | 2026-08-12 | Real KML/KMZ geometries, multi-layer map |
| [0.5.0](CHANGELOG.md#050--2026-08-12) | 2026-08-12 | Professional map-centric UI |
| [0.6.0](CHANGELOG.md#060--2026-08-12) | 2026-08-12 | Archive, users, breach, and other actions persist |
| [0.7.0](CHANGELOG.md#070--2026-08-16) | 2026-08-16 | System design docs |
| [1.0.0](CHANGELOG.md#100--2026-08-25) | 2026-08-25 | Per-site names and file inspect card |

## Features

- **KML Upload & Parsing** — Upload KML/KMZ files with multi-polygon support, auto-matching to existing mining nodes
- **Interactive Map View** — Click mining area polygons to access upload history via a side panel
- **Change Detection** — Automated boundary diff metrics (area change, perimeter change) + visual polygon overlay comparison
- **Audit Trail** — Immutable compliance logging of all system actions
- **PDF Reports** — Per-node history export for external stakeholders
- **Role-Based Access** — Central Administrator (all sites) and Field Users (upload + view only on assigned monitoring areas)

## Architecture

See **[docs/system-design.md](docs/system-design.md)** for the container diagram,
auth flow, KML ingestion pipeline, data model, and deployment topology.

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + Vanilla CSS |
| Map | Leaflet.js via react-leaflet, OpenStreetMap tiles |
| Backend | Next.js Route Handlers |
| Database | PostgreSQL + PostGIS (Supabase, local Docker, or [Oracle Always Free](docs/oracle-cloud-postgis.md)) |
| ORM | Prisma, with raw SQL for PostGIS geometry |
| Auth | Google OAuth + HMAC-signed session cookie |
| Hosting | Vercel (Dockerfile provided for self-hosting) |

## Getting Started

```bash
# Install dependencies
npm install

# Copy env template and fill Google OAuth + DATABASE_URL
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Google OAuth redirect URI must be:
`http://localhost:3000/api/auth/callback/google`

## Supabase (production database)

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Project Settings → Database → Connect** and copy:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL` (append `?pgbouncer=true&connection_limit=1`)
   - **Direct connection** (port `5432`) → `DIRECT_URL`
3. Optional: **Project Settings → API** → set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Put the values in `.env.local`, then:

```bash
npm run db:supabase
```

That enables PostGIS, pushes the Prisma schema, and creates a GIST index on `UploadGeometry.geom`.

Hosted Supabase Security Advisor may flag `public.spatial_ref_sys` as “RLS Disabled in Public”. That table is the PostGIS EPSG catalog, owned by `supabase_admin`, so you **cannot** enable RLS from the SQL Editor. It is safe to ignore. If you want to try locking the Data API anyway, run `prisma/sql/01_lock_postgis_catalog.sql` (it skips `ENABLE RLS` when you are not the owner).

Smoke test: `GET /api/health?deep=1` should return `"database":"ok"`.

Free/cheap hosts if you want to leave Supabase: **[docs/database-hosting-alternatives.md](docs/database-hosting-alternatives.md)**. Neon is the usual hosted free pick; local Docker is already in this repo. For a free VM that does not pause, see **[Oracle Cloud Always Free + PostGIS](docs/oracle-cloud-postgis.md)**.

## Deploy to Vercel (dashboard only — no CLI)

See **[docs/vercel-dashboard-deploy.md](docs/vercel-dashboard-deploy.md)**.

Short version:
1. Push this repo to GitHub
2. [vercel.com/new](https://vercel.com/new) → Import `minearchive`
3. Add env vars (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, Google OAuth, …)
4. Deploy → add the `*.vercel.app` origin/redirect in Google Cloud → Redeploy

### Caching
- Static assets: long CDN cache (`vercel.json`)
- List APIs (nodes/uploads/users/audit): ~240s Data Cache with tag invalidation on writes
- Auth + `/api/health`: never CDN-cached

## Project Structure

```
minearchive/
├── app/
│   ├── globals.css          # Design system (GeoFlow-inherited dark theme)
│   ├── layout.js            # Root layout
│   ├── login/               # Login page
│   ├── components/          # Shared components (Header, Sidebar)
│   └── (main)/              # Authenticated route group
│       ├── layout.js        # Header + Sidebar layout
│       ├── dashboard/       # Dashboard with stats + map overview
│       ├── map/             # Interactive map with side panel
│       ├── upload/          # KML upload form
│       ├── nodes/           # Node management (admin)
│       ├── users/           # User management (admin)
│       └── audit/           # Audit log
├── public/                  # Static assets
├── package.json
└── README.md
```

## Design System

Minimal, flat, IDE-style dark theme inherited from GeoFlow/GeoDB:

- Background: `#1e1e1e` | Surfaces: `#252526`, `#2d2d30`
- Accent: `#007acc` | Text: `#e2e8f0` | Muted: `#64748b`
- Border radius: `0px` everywhere (sharp corners)
- No glassmorphism, no gradients — flat and data-dense

## License

Private — All rights reserved.
