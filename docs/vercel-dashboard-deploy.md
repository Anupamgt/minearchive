# Deploy MineArchive via Vercel Dashboard (no CLI)

## 1. Push this branch / merge to GitHub

Ensure `Anupamgt/minearchive` has the latest code on GitHub.

## 2. Import the project

1. Open [vercel.com/new](https://vercel.com/new)
2. Import **Anupamgt/minearchive**
3. Framework preset: **Next.js** (auto)
4. Root directory: `.`
5. Do **not** override the build command — `npm run build` already runs `prisma generate`

## 3. Environment variables

In **Project → Settings → Environment Variables**, add for **Production** (and Preview if you want):

| Name | Value |
|---|---|
| `DATABASE_URL` | Supabase **Transaction** pooler (`:6543` + `pgbouncer=true&connection_limit=1&sslmode=require`) |
| `DIRECT_URL` | Supabase **Session** pooler (`:5432` + `sslmode=require`) |
| `SESSION_SECRET` | Long random hex (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `GOOGLE_CLIENT_ID` | From Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud OAuth client |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-DEPLOYMENT.vercel.app/api/auth/callback/google` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-DEPLOYMENT.vercel.app` |
| `GOOGLE_ADMIN_EMAILS` | Your Gmail (comma-separated for multiple admins) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional — project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional — publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional — secret key |
| `ALLOW_DEMO_LOGIN` | Leave **unset** in production |

> Tip: deploy once first to learn the `*.vercel.app` URL, then set `GOOGLE_REDIRECT_URI` / `NEXT_PUBLIC_APP_URL` and **Redeploy**.

## 4. Google OAuth for the Vercel domain

In Google Cloud → Credentials → your OAuth Web client, add:

- **Authorized JavaScript origin:** `https://YOUR-DEPLOYMENT.vercel.app`
- **Authorized redirect URI:** `https://YOUR-DEPLOYMENT.vercel.app/api/auth/callback/google`

Keep the localhost entries for local dev.

## 5. Deploy

Click **Deploy**. Every push to the Production branch (usually `main`) auto-deploys afterward.

## 6. Smoke test

- `https://YOUR-DEPLOYMENT.vercel.app/api/health?deep=1` → `"database":"ok"`
- `/login` → Google sign-in works
- Logged-out visit to `/dashboard` → redirects to `/login`

## Caching behavior on Vercel

- **CDN:** static assets long-cached (`vercel.json` headers)
- **Data Cache:** nodes / uploads / users / audit lists cached ~60s via `unstable_cache` + tags
- **Mutations** (create node/user, upload KML) call `revalidateTag(..., 'max')` so lists refresh on next read
- **Auth APIs / health:** `Cache-Control: no-store` (never public CDN)
