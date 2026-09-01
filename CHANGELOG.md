# Changelog

All notable MineArchive releases are recorded here. Versions follow
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

Git tags match these versions (`v0.1.0` … `v1.0.0`) so you can check out any
milestone: `git checkout v0.4.0`.

---

## [Unreleased]

### Added
- Many-to-many user ↔ monitoring-area assignments (`UserSiteAssignment`). Admins assign one field user to several sites from Create/Edit user.
- Field users only see map layers, uploads, dashboard stats, and site-related activity for assigned sites. Unassigned users get empty lists (no all-sites fallback).

### Notes
- Production must run `npx prisma db push` (or migrate) after deploy so the `UserSiteAssignment` table exists. This environment had no `DATABASE_URL` / `DIRECT_URL`.

### Security
- PostGIS `spatial_ref_sys` is owned by `supabase_admin`, so hosted SQL Editor cannot `ENABLE ROW LEVEL SECURITY` (`must be owner of table`). That Security Advisor item is a false positive (EPSG catalog, no tenant data). Ignore it, or revoke `anon`/`authenticated` if the role allows. Do not move the PostGIS extension on a live database.

---

## [1.0.0] — 2026-08-25

**Site names and file inspect card.** Current production line.

### Added
- Store each KML placemark name and ExtendedData on ingest (`UploadGeometry.name`, `sourceProperties`, MultiGeometry parts).
- Map legend lists individual site names instead of repeating the filename.
- File inspect card: polygon count, named-site count, total area/perimeter, site list, leftover KML attributes (`LEASE_NO`, operator, …).
- Click a file, legend row, or polygon to highlight that site on the map.

### Notes
- Files uploaded before this release have no stored names. Re-upload those KMLs to label sites.

**Tag:** `v1.0.0`

---

## [0.7.0] — 2026-08-16

**System design documentation.**

### Added
- `docs/system-design.md` with architecture, auth, ingest, and deployment diagrams.

**Tag:** `v0.7.0` · **Commit:** `b5ae2af`

---

## [0.6.0] — 2026-08-12

**Live admin actions.** Buttons that previously did nothing now write to the database.

### Fixed
- Archive updates monitoring-area status.
- User edit/disable, breach notices, upload soft-delete, and dashboard stats call real APIs.

**Tag:** `v0.6.0` · **Commit:** `13cd450`

---

## [0.5.0] — 2026-08-12

**Professional map-centric UI.**

### Added
- Light “Field Survey” design system, ArcGIS-style map Table of Contents, and guided login/dashboard/CRUD copy.

**Tag:** `v0.5.0` · **Commit:** `2682562`

---

## [0.4.0] — 2026-08-12

**Real multi-layer GIS.**

### Added
- Persist PostGIS polygons from KML (`ST_Force2D` / `ST_GeomFromGeoJSON`).
- Multiple KML overlays on one map (`/api/map/layers`).
- KMZ support and auto-show of a freshly uploaded file.

### Fixed
- Admin list APIs read-after-write (dropped Next 16 SWR data cache that served stale lists).

**Tag:** `v0.4.0` · **Commit:** `3eb94b6`

---

## [0.3.0] — 2026-08-08

**Hosted production stack.** Auth, database, and Vercel deploy.

### Added
- Google OAuth plus email login.
- Supabase Postgres + PostGIS (`DATABASE_URL` pooler, `DIRECT_URL` session).
- Vercel deploy prep, list-API caching experiment, Web Analytics.

### Fixed
- Critical auth gaps; production Google redirect URI (no localhost in prod).
- Case-insensitive email login.
- High-severity dependency CVEs.

**Tag:** `v0.3.0` · **Commit:** `393d1e5`

---

## [0.2.0] — 2026-06-28

**Working GIS product** after the original phased build (Phases 3–5) plus first production polish.

### Added
- Phase 3 — backend APIs and PostGIS setup (`2e119f3`).
- Phase 4 — API integration and OpenStreetMap / Leaflet map (`128d72c`).
- Phase 5 — Dockerfile, JWT role middleware, admin breach trigger (`ab77040`).
- Toasts, CSV export, modal dialogs, Next.js 16 `proxy` convention (`0480a20`).

**Tag:** `v0.2.0` · **Commit:** `0480a20`

---

## [0.1.0] — 2026-06-19

**MVP.** First commit of MineArchive: mining-area archive shell, KML-oriented data model, and the initial Next.js app.

**Tag:** `v0.1.0` · **Commit:** `88b90b8`

---

[1.0.0]: https://github.com/Anupamgt/minearchive/compare/v0.7.0...v1.0.0
[0.7.0]: https://github.com/Anupamgt/minearchive/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Anupamgt/minearchive/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Anupamgt/minearchive/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Anupamgt/minearchive/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Anupamgt/minearchive/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Anupamgt/minearchive/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Anupamgt/minearchive/releases/tag/v0.1.0
