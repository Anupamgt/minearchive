<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

MineArchive is a single Next.js 16 app (App Router, JavaScript, Turbopack dev) backed by PostgreSQL + PostGIS via Prisma. There is one service to run: the Next.js dev server. Standard commands live in `package.json` (`npm run dev`, `npm run lint`, `npm run build`) and `README.md`.

Non-obvious setup/run caveats:

- Requires a running PostgreSQL with the `postgis` extension. `UploadGeometry.geom` is a PostGIS `geometry` column, so a plain Postgres won't accept the schema. In this VM it is installed locally; start it with `sudo pg_ctlcluster 16 main start` if it isn't already `online` (`sudo pg_lsclusters`).
- The DB `minearchive_db` / role `minearchive_user` (password `minearchive_pass`) already exist with PostGIS enabled. If tables are missing, recreate them with `DATABASE_URL="postgresql://minearchive_user:minearchive_pass@localhost:5432/minearchive_db?schema=public" npx prisma db push` (there are no migration files — schema is applied via `db push`). There is no seed script; two login users are seeded manually (see below) — re-seed with a short Prisma `upsert` script if the DB is empty.
- Env vars come from `.env.local` (git-ignored, Next.js loads it automatically; the Prisma CLI does NOT read `.env.local`, so pass `DATABASE_URL` inline for `prisma` commands). Key vars: `DATABASE_URL`, `SESSION_SECRET` (required — auth throws without it), `ALLOW_DEMO_LOGIN=true`, `GOOGLE_ADMIN_EMAILS`.
- Local login without Google OAuth: `admin@minearchive.co` / `admin123` (admin) and `harpreet@mine.co` / `user123` (user). Passwords are stored as plaintext in `passwordHash` (MVP demo); `ALLOW_DEMO_LOGIN=true` also enables an `admin123`/`user123` bypass. Google OAuth is unconfigured locally and not needed.
- Health probe: `GET /api/health?deep=1` returns `checks.database: "ok"` when the DB is reachable — a fast way to confirm the app↔DB wiring.
- Known pre-existing bug (not an environment issue): KML upload (`POST /api/uploads`) fails with `DOMParser.parseFromString: the provided mimeType "undefined" is not valid` because the installed `@xmldom/xmldom` 0.9.x requires a mimeType argument the code omits. Everything else (login, node/user CRUD, audit log, map, dashboard) works end-to-end.
- `npm run lint` currently reports 4 pre-existing `react-hooks/set-state-in-effect` errors in `app/components/Header.js` and `app/components/Sidebar.js`; these are pre-existing, not caused by setup.
