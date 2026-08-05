# MineArchive — Zero-Cost Production Launch Roadmap

Goal: ship to production **today** with **$0 recurring cost**.

---

## ⚠️ Critical bugs found during audit (must-fix, not optional)

These aren't style nits — right now, in the current codebase, **auth is not actually enforced**.

1. **`proxy.js` auth gate is inverted.**
   ```12:14:proxy.js
   if (!sessionCookie && (pathname.startsWith('/dashboard') || pathname.startsWith('/map') || ...)) {
     return NextResponse.next();
   }
   ```
   This says "if there is **no** session cookie on a protected route, let them through." It's backwards — right now `/dashboard`, `/map`, `/upload`, `/nodes`, `/users`, `/audit` are all publicly accessible with **zero login required**, from any browser, right now.

2. **Client-side "Persona Switcher" lets anyone self-grant Admin.**
   ```24:32:app/components/Header.js
   const handlePersonaToggle = (newRole) => {
     const mockUser = newRole === 'Admin' ? {...} : {...};
     const token = Buffer.from(JSON.stringify(mockUser)).toString('base64');
     document.cookie = `minearchive_session=${token}; path=/; max-age=604800`;
     ...
   ```
   This is demo scaffolding — it writes an admin-role cookie directly from the browser, no server involved at all. It must be removed (or hard-disabled) before any real user touches this.

3. **Session cookie is unsigned.** Even without the persona switcher, the cookie is just `base64(JSON)` — anyone can hand-craft `{"role":"Admin"}` in devtools. No server-side signature is checked anywhere.

4. **`/api/users` POST will throw on user creation.** The audit log write uses a hardcoded `userId: 'Admin'` string, which doesn't match any real `User.id` — this violates the `AuditLog → User` foreign key and throws, so **creating a user from the admin panel currently fails with a 500** even though the row may partially write.

5. **Demo password bypass in `/api/auth/login`.** Any email + password `admin123` or `user123` logs in successfully, regardless of the real stored hash. Fine for local demo, dangerous in prod.

**None of this is a knock on the OAuth work already done** — Google sign-in itself is solid. These are pre-existing issues in the session/authorization layer sitting underneath it.

---

## Zero-cost architecture

| Layer | Choice | Why free |
|---|---|---|
| Hosting | **Vercel (Hobby plan)** | Native Next.js support, free SSL, free `*.vercel.app` subdomain, auto-deploy from GitHub |
| Database | **Supabase (Free tier) Postgres + PostGIS** | `@supabase/supabase-js` is already a dependency; free tier includes the `postgis` extension |
| Auth | **Google OAuth** (already built) | No cost at this scale/scope (`openid email profile` only) |
| File storage | **None needed yet** | Current upload route only stores the filename, not file bytes — no storage cost today. Flag for later (see Phase 6) |
| Domain | **`*.vercel.app` subdomain** | Avoids any domain registration cost |
| CI/CD | **GitHub → Vercel auto-deploy** | Repo already exists at `Anupamgt/minearchive` |

---

## Phased plan for today

### Phase 0 — Repo hygiene (~5 min)
- [x] Confirm `.env` / `.env.local` are gitignored (already verified — safe)
- [ ] Commit current OAuth work (`lib/auth.js`, `app/api/auth/google`, `app/api/auth/callback/google`, schema change, login route)

### Phase 1 — Fix the critical bugs above (~45–60 min, BLOCKING)
- [ ] Fix `proxy.js` redirect logic (unauthenticated → `/login`)
- [ ] Remove/gate the Persona Switcher in `Header.js`
- [ ] Sign the session cookie (HMAC via Node's built-in `crypto`, zero new dependencies/cost)
- [ ] Fix `/api/users` audit log to use a real actor id, not `'Admin'`
- [ ] Decide: keep or kill the `admin123`/`user123` password bypass for prod

### Phase 2 — Provision free infra (~30–45 min)
- [x] Repo wiring for Supabase (Prisma `DIRECT_URL`, `npm run db:supabase`, PostGIS SQL)
- [ ] Create a free Supabase project → copy pooler + direct connection strings into `.env.local`
- [ ] Run `npm run db:supabase` (enables PostGIS, pushes schema, GIST index)
- [ ] Create/confirm a free Vercel account, import the GitHub repo

### Phase 3 — Google OAuth for the prod domain (~15–20 min)
- [ ] In Google Cloud Console, add to the existing OAuth client:
  - Authorized redirect URI: `https://<your-app>.vercel.app/api/auth/callback/google`
  - Authorized JS origin: `https://<your-app>.vercel.app`
- [ ] If the OAuth consent screen is still in **Testing** mode, only allow-listed test users can sign in — add real testers' emails, or publish the app (still free) for anyone to use it

### Phase 4 — Vercel environment variables (~10 min)
```
DATABASE_URL=<supabase pooled connection string>
GOOGLE_CLIENT_ID=<same as local>
GOOGLE_CLIENT_SECRET=<same as local>
GOOGLE_REDIRECT_URI=https://<your-app>.vercel.app/api/auth/callback/google
NEXT_PUBLIC_APP_URL=https://<your-app>.vercel.app
GOOGLE_ADMIN_EMAILS=admin@minearchive.co
```

### Phase 5 — Deploy & smoke test (~20–30 min)
- [ ] Push to `main` → Vercel auto-builds
- [ ] Test: logged-out redirect works, email/password login, Google OAuth login, admin-only pages blocked for `User` role, KML upload, create-user from admin panel, audit log page loads

### Phase 6 — Fast-follows (not blocking today)
- Real object storage for uploaded KML/attachments (Supabase Storage free tier, 1GB)
- Fully `httpOnly` + `secure` cookie; move client role-reads to a small `/api/me` endpoint instead of parsing the cookie in the browser
- Replace stubbed polygon area/perimeter (`12.5` / `340.0` hardcoded) with real `ST_Area`/`ST_Perimeter` PostGIS calls
- Remove demo credentials entirely before wider rollout
- Basic rate limiting on `/api/auth/login`
- Supabase free projects **pause after 7 days of no activity** — a free [UptimeRobot](https://uptimerobot.com) ping can keep it warm if traffic is sparse

---

## Free-tier limits to know
- **Vercel Hobby**: personal/non-commercial use per ToS, 100GB bandwidth/mo, ~10s serverless function timeout
- **Supabase Free**: 500MB DB storage, pauses after 7 days idle, 2 free projects per org
- **Google OAuth**: free at this scope regardless of user volume; only paid/verification-gated if you request sensitive scopes (not the case here)
