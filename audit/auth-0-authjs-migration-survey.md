# Auth-0 — Auth.js Migration Survey

**Repo:** budget-tracker · **Branch:** `feat/phase9b-postgres-runtime-core` · **Date:** 2026-08-10
**Status:** READ-ONLY. No files modified, nothing installed, no commits.

---

## 1. Current authentication implementation

### How users log in

A single SvelteKit **form action** on [src/routes/login/+page.server.ts](src/routes/login/+page.server.ts). The [src/routes/login/+page.svelte](src/routes/login/+page.svelte) form `POST`s `username` + `password` via `use:enhance`. Flow:

1. `validateLoginInput(username, password)` — trims username, rejects empties.
2. `queryOne('SELECT id, username, password_hash FROM users WHERE username = $1', …)`.
3. `verifyUserCredentials(user, password)` — bcrypt compare.
4. `createToken(userId, username)` → `jwt.sign(..., { expiresIn: '7d' })`.
5. `cookies.set('session', token, { path:'/', httpOnly, sameSite:'lax', maxAge:7d, secure: NODE_ENV==='production' })`.
6. `redirect(302, '/dashboard')`.

The "Remember me" checkbox and "Continue with passkey" chip are **decorative** — no auth logic is attached to either.

### How passwords are validated / hashed

Both live in [src/lib/auth.ts](src/lib/auth.ts) and use **bcryptjs v3.0.3 (synchronous)**:

- `hashPassword(pw)` = `bcrypt.hashSync(pw,10)` → produces **`$2b$10$`** 60-char hashes (verified by generating one).
- `verifyPassword(pw, hash)` = `bcrypt.compareSync(pw, hash)`.

### How sessions are created / what they are

**Stateless JWT sessions.** No session table exists anywhere. The JWT is created at login, stored in the httpOnly `session` cookie, and verified on every request. **Pure JWT — no database and no hybrid.**

### Where JWT secrets are read

- [src/lib/auth.ts:4-11](src/lib/auth.ts#L4-L11): `process.env['JWT_SECRET']`, with a dev fallback and a hard throw when `DATABASE_URL` is set but `JWT_SECRET` is missing.
- [src/hooks.server.ts:6-12](src/hooks.server.ts#L6-L12): an identical startup guard.

### How cookies are created/read/cleared

The `session` cookie is touched in **exactly three places** (this is the entire cookie surface):

| Operation | File |
|---|---|
| Set | [src/routes/login/+page.server.ts:33](src/routes/login/+page.server.ts#L33) |
| Read | [src/hooks.server.ts:26](src/hooks.server.ts#L26) — `event.cookies.get('session')` |
| Delete | [src/routes/logout/+server.ts:4](src/routes/logout/+server.ts#L4) |

### How authenticated users are identified

`verifyToken()` decodes the JWT to `{ userId: number, username: string }` and writes it to `event.locals.user` in hooks. `App.Locals.user?: { userId: number; username: string }` ([src/app.d.ts:5-7](src/app.d.ts#L5-L7)).

### How `locals` are populated

Only in [src/hooks.server.ts:30](src/hooks.server.ts#L30): `event.locals.user = payload`. The root [src/routes/+layout.server.ts](src/routes/+layout.server.ts) then exposes `user: locals.user ?? null` to the client; `+layout.svelte` uses `$page.data.user` only to decide sidebar visibility on `/`.

### How logout works

[src/routes/logout/+server.ts](src/routes/logout/+server.ts) — `GET /logout` deletes the `session` cookie and 302s to `/login`. The JWT itself is not invalidated (stateless); it simply stops being accepted once the cookie is gone.

### How session expiration works

JWT `exp:7d`. Each request: `jwt.verify()` either succeeds or returns `null` (on expiry or tampering) → hooks redirect to `/login`. There is no sliding expiration, no refresh, no keep-alive.

### How protected routes are enforced

Global, in [src/hooks.server.ts:23-39](src/hooks.server.ts#L23-L39): the only public path is `/login` (and `/`, which 302s to `/dashboard`). Everything else requires a valid `session` cookie or gets a 302 to `/login`. SvelteKit applies this handle to **all** routes, including every `/api/*` route — so the API is protected by the same hook.

### How API/server endpoints enforce authentication

Two layers:

1. The global hook (above) guarantees `locals.user` exists before any `+server.ts` / `+page.server.ts` runs.
2. Every handler additionally does `const userId = locals.user!.userId;` (80+ call sites) and passes `userId` as the first argument to a `$lib/server/*` service. Authorization is then **ownership-scoped at the query level** — every service filters by `eq(..., userId)`.

---

## 2. Authentication data model

From [src/lib/database/schema.ts:36-45](src/lib/database/schema.ts#L36-L45) and the live DDL in [src/lib/database/init.ts:25-30](src/lib/database/init.ts#L25-L30):

```sql
users (
 id serial PRIMARY KEY,            -- integer, app-wide FK target
 username text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
)
```

- **Login identifier:** `username` (no `email` column anywhere in the repo).
- **Password hash:** `password_hash` text, bcrypt `$2b$10$`.
- **Roles/permissions:** none — there is no role, permission, or admin concept.
- **Session tables:** none.
- **Foreign keys:** `categories`, `transactions`, `lendings`, `recurring_transactions`, `lending_payments` all reference `users(id)` with `ON DELETE CASCADE` and expect **`integer`** user IDs.

**Auth.js compatibility of this schema:** `users` is *not* compatible with the Auth.js adapter's default model out of the box — Auth.js expects `id`, `name`, `email`, `emailVerified`, `image`, plus separate `account`/`session`/`verificationToken` tables, and a string `id`. Because every child table in this app is keyed to an integer `users.id`, an Auth.js adapter would require either custom-table mapping (the adapter accepts your own `usersTable`) or a schema migration adding `email` + the three adapter tables. See §6.

---

## 3. Auth call-site inventory

### A. Core authentication

| Site | Purpose |
|---|---|
| [src/lib/auth.ts](src/lib/auth.ts) | `hashPassword`, `verifyPassword`, `createToken`, `verifyToken`; `JWT_SECRET` resolution |
| [src/lib/utils/loginValidation.ts](src/lib/utils/loginValidation.ts) | `validateLoginInput`, `verifyUserCredentials` (imports `verifyPassword`) |
| [src/routes/login/+page.server.ts](src/routes/login/+page.server.ts) | login form action; token issuance; cookie set |
| [src/routes/logout/+server.ts](src/routes/logout/+server.ts) | cookie delete; redirect |

### B. Session handling

- Cookie `session`: [src/hooks.server.ts:26](src/hooks.server.ts#L26), [src/routes/login/+page.server.ts:33](src/routes/login/+page.server.ts#L33), [src/routes/logout/+server.ts:4](src/routes/logout/+server.ts#L4).
- `App.Locals.user` shape: [src/app.d.ts:5-7](src/app.d.ts#L5-L7).
- No `getSession`, no session store, no session table.

### C. Protected server operations (`locals.user!.userId`)

**80 call sites** in these files — every one routes into a `$lib/server/*` service that takes `userId: number` as its first parameter:

- **Page server loads/actions:** `dashboard`, `transactions`, `transactions/new`, `transactions/[id]/edit`, `categories`, `lending`, `borrowed`, `recurring`, `recurring/new`, `recurring/[id]`, `reports`, `net-worth`.
- **API handlers:** `api/transactions`, `api/transactions/[id]`, `api/transactions/export`, `api/categories`, `api/categories/[id]`, `api/lendings`, `api/lendings/[id]`, `api/lendings/[id]/payments`, `api/recurring`, `api/recurring/[id]`, `api/search`, `api/reports/monthly`, `api/reports/by-category`, `api/reports/export`.

### D. Protected routes

- [src/hooks.server.ts:23-39](src/hooks.server.ts#L23-L39) — the single enforcement point (public = `['/login']` only).
- [src/routes/login/+page.server.ts:6-10](src/routes/login/+page.server.ts#L6-L10) — redirects already-authenticated users away from `/login`.
- [src/routes/+layout.svelte:16-19](src/routes/+layout.svelte#L16-L19) — client-side sidebar visibility from `$page.data.user`.
- [src/routes/login/+page.svelte:39-60](src/routes/login/+page.svelte#L39-L60) — form `use:enhance` handling of redirect/failure.

### E. API authentication

None of the 14 `+server.ts` files perform their own token verification — they trust `locals.user` set by hooks and read `userId`. Tests confirm this: [tests/unit-test/apiLendings.test.ts](tests/unit-test/apiLendings.test.ts) constructs `makeLocals(userId)` and never mocks a token.

### F. Tests

- [tests/unit-test/loginValidation.test.ts](tests/unit-test/loginValidation.test.ts) — imports `hashPassword` + `verifyUserCredentials` directly (real bcrypt hashes, no DB).
- [tests/e2e/login.spec.ts](tests/e2e/login.spec.ts) — full login/error/logout/redirect/session-persistence flows against seeded `demo` user.
- All other unit tests mock `getDrizzle()`/services and are auth-agnostic (they take `userId` as a plain argument).

### G. Configuration/environment

- `JWT_SECRET` (auth.ts + hooks guard), `DATABASE_URL` / `POSTGRES_URL` (DB), `LOCAL_DEV_DATABASE_URL` (dev-only wiring in [src/lib/database/loadEnv.ts](src/lib/database/loadEnv.ts)), `SEED_DEMO` (e2e gate), `NODE_ENV` (cookie `secure`).
- Legacy refs: `SQLITE_PATH`, `DEMO_TODAY` (seed scripts only).

### H. Documentation/scripts

- [scripts/seed-demo.ts](scripts/seed-demo.ts) and [scripts/verify-neon.ts](scripts/verify-neon.ts) import `hashPassword` (and verify/create/verifyToken) from `../src/lib/auth.js`.
- [scripts/migrate-sqlite-to-neon.ts](scripts/migrate-sqlite-to-neon.ts) — historical migration tooling.
- [plans/hide-sidebar-unauthenticated.md](plans/hide-sidebar-unauthenticated.md) — the only auth-adjacent plan; already implemented.

---

## 4. SvelteKit integration

The complete current lifecycle:

```
REQUEST → handle (hooks.server.ts)
 ├─ / → 302 /dashboard
 ├─ /login → resolve() (public)
 └─ all other → cookies.get('session')
    → verifyToken() [JWT verify, 7d exp]
    → valid?   event.locals.user = {userId, username} → resolve()
    → invalid? 302 /login
 → resolve → layout server load (exposes user)
 → +page.server.ts load / actions → $lib/server/* services (userId-scoped)
 → response
```

- **`handle`:** the only hook file; owns both env guard and all routing logic.
- **`event.locals`:** the only mutation is `locals.user` (hooks). `App.Locals` declares it in [src/app.d.ts](src/app.d.ts).
- **`resolve`:** called normally; Auth.js would wrap this (see §5/§6).
- **Server loads:** `load({ locals })` → `locals.user!.userId`.
- **Form actions:** SvelteKit `use:enhance` with `fail()` error payloads and `redirect()`.
- **API `+server.ts`:** handlers read `locals.user!.userId`; no per-handler auth code.
- **Redirects:** `/`→`/dashboard`, unauthenticated→`/login`, logout→`/login`, login success→`/dashboard`.
- **Cookies:** only `session`, managed in the three sites in §1.

---

## 5. Auth.js compatibility research

**Current project stack** (verified installed):

- `@sveltejs/kit` **2.70.1** · `svelte` 5.56.8 · `vite` 8.1.5 · `typescript` 6.0.3
- `drizzle-orm` **^0.45.2** · `@neondatabase/serverless` ^1.1.0 · `drizzle-kit` ^0.31.10
- `bcryptjs` 3.0.3 · `jsonwebtoken` 9.0.3
- Package manager: **npm** (`package-lock.json` present, `.npmrc` exists)

**Current official Auth.js packages** (registry, checked 2026-08-10):

- `@auth/sveltekit` **1.11.3** · `@auth/core` **0.41.3** · `@auth/drizzle-adapter` **1.11.3**

**⚠️ Critical ecosystem finding (from the official Auth.js docs):** *"The Auth.js project is now part of Better Auth."* The official site's own recommendation:

- Auth.js **continues to receive security patches and critical fixes** (now handled by Better Auth).
- For a **new project** the docs say: *"we strongly recommend using Better Auth."*
- For a **stable existing setup** they say: *"there's no urgent need to migrate."*

This is a standing-maintenance consideration for this migration and is factored into §13. The remainder of this survey evaluates Auth.js as instructed.

**Documented Auth.js SvelteKit integration** (current docs):

1. Install `@auth/sveltekit` (do **not** install `@auth/core` directly).
2. Mandatory env var: `AUTH_SECRET` (generate via `npx auth secret`).
3. `src/auth.ts` → `export const { handle } = SvelteKitAuth({ providers: [] })`.
4. `hooks.server.ts` → `export { handle } from './auth'`.
5. `event.locals.auth()` becomes available in every `+layout.server.ts` / `+page.server.ts`; call it and either allow or `redirect('/login')`.
6. The base setup does not yet protect anything — route protection is explicit per-route/global (the app already has this pattern in hooks).

**Credentials provider** (documented):

- `Credentials({ credentials: { username: {…}, password: { type: 'password' } }, async authorize(credentials) { … } })`.
- Return a user object on success or `null` on failure; custom error text via `class X extends CredentialsSignin { code = "…" }`.
- **Limitation:** users authenticated via Credentials are *not persisted by the provider* — `authorize()` is responsible for looking up the existing user. This matches the app's model (admin/seeded users, no registration).
- Password verification is entirely your code — bcrypt compare is not bundled. This is ideal for hash preservation (§7).

**Session strategies** (documented):

- **JWT** (default when no adapter): encrypted JWT in an httpOnly cookie; sign-out destroys the cookie. No DB needed. **No schema change.**
- **Database:** session ID in cookie, session row in DB per request; requires an adapter + `session` table. Trade-offs noted: per-request DB roundtrips, adapter/edge caveats.

**Drizzle adapter** (documented):

- Install `@auth/drizzle-adapter`; pass `adapter: DrizzleAdapter(db)`.
- **Custom tables are supported**: second argument accepts `usersTable`, `accountsTable`, `sessionsTable`, `verificationTokensTable`. `sessionsTable` is *only* needed for the database-session strategy; `verificationTokensTable` only for Magic Link.
- Credentials-provider + adapter interaction is not blessed by the docs (no user row is created by the provider anyway).

**Environment variables:** `AUTH_SECRET` (mandatory, replaces the role of `JWT_SECRET`), plus host configuration (`AUTH_TRUST_HOST` / `AUTH_URL`) for non-localhost production (relevant on Vercel).

---

## 6. Migration strategy options

### Option A — Credentials + **database sessions**

- **Schema:** must add `account`, `session` (+ adapter `users` column expectations). Child tables keep integer FKs but Auth.js adapter wants its own user model — needs custom-table mapping.
- **Code:** adapter wiring, session table, `session.strategy: 'database'`.
- **Session behavior:** cookie holds only a session ID; each request hits the DB. Different from today's stateless model.
- **Complexity:** high. **Risks:** adapter/schema mismatch with integer IDs + no email; per-request DB roundtrip on a serverless Neon pool; Credentials users aren't persisted so the adapter buys little.
- **Compat/impact:** forces a schema migration and a forced re-login; heavy test churn.

### Option B — Credentials + **JWT sessions**

- **Schema:** none.
- **Code:** `src/auth.ts` with Credentials provider + `authorize()` calling the existing bcrypt verify; hooks swap to the Auth.js handle; login action switches to Auth.js sign-in; logout to sign-out.
- **Session behavior:** same conceptual model as today (stateless encrypted JWT cookie), new cookie name/encryption.
- **Complexity:** low–medium. **Risks:** cookie name change → one-time re-login; brute-force protection is your responsibility (it already is today).
- **Compat/impact:** no schema change, no adapter; existing users keep passwords (§7); e2e login flows largely intact.

### Option C — Full **Drizzle adapter**

- **Schema:** add `email` to `users`, add `account`/`session`/`verificationToken` tables (or map custom tables).
- **Code:** `DrizzleAdapter(db)` + adapter-managed schema + sessions.
- **Assessment:** heaviest change for the least benefit in a username-only, Credentials-only, no-registration app. The adapter's user model (`name`/`email`/`image`) is a poor fit for a `username`-login table with no email, and the `users.id` integer mismatch requires custom-table mapping either way. Recommend **against**.

### Option D — Credentials + JWT, **preserve `users` table and `locals.user`** (recommended)

Essentially **Option B plus a thin preservation layer**:

- Keep the `users` table and every `$lib/server/*` service unchanged (all userId-scoped — untouched by the swap).
- Keep `App.Locals.user?: { userId: number; username: string }` and repopulate it in hooks from the Auth.js session, mapping `session.user.id` (string) → `userId` (number) and `name` → `username`. **Result: all 80+ `locals.user!.userId` call sites compile and behave identically.**
- Keep `hashPassword`/`verifyPassword` in `auth.ts` (Auth.js `authorize()` calls `verifyPassword` directly) so `loginValidation` and all seeds/scripts are untouched.
- Only the session-cookie machinery (create/read/delete/verify) moves to Auth.js.

This is the **safest architecture for this codebase**: zero schema migration, zero password impact, near-zero churn in server/UI code, and a clean seam (the Auth.js `handle` + one hook refactor + login/logout swap).

---

## 7. Existing user/password compatibility

**Current:** bcryptjs **v3.0.3**, cost **10**, format **`$2b$10$`**, 60 chars, generated by `hashPassword()` (verified live). Verification is `bcrypt.compareSync` in `verifyPassword`.

**Auth.js compatibility:** the Credentials `authorize(credentials)` callback is plain code — you call your own `verifyPassword(credentials.password, user.password_hash)`. `bcrypt.compare` operates on the stored `$2b$` hash exactly as today. **Existing hashes authenticate without any change and without forcing password resets.** Nothing in Auth.js re-hashes or rewrites stored passwords.

**What must be verified at implementation time (not now):** only that `authorize()` receives the same `{ username, password }` values the form currently posts, and that the lookup query (`SELECT … FROM users WHERE username = $1`) moves into `authorize()` (or a tiny `findUserByUsername` helper). No hash-format work is required.

---

## 8. Session migration

- **Do current sessions remain valid?** **No.** The cookie name changes from `session` to `authjs.session-token` (and `__Secure-authjs.session-token` in production) and the payload is an Auth.js-encrypted JWT using `AUTH_SECRET` — the current `JWT_SECRET`-signed tokens are not readable.
- **Will all users log in again?** **Yes, exactly once.** This is unavoidable given the cookie format change. It is a one-time event, not a recurring one.
- **Cookie invalidation:** automatic — the old `session` cookie is simply ignored by the new hook (and should be explicitly deleted in the login/logout handlers for cleanliness).
- **Migration bridge:** **not required.** There is no DB session table to migrate, no token store, nothing to port. The only "cost" is forced re-login, and no data is at risk.
- **Gradual path:** possible. Because `locals.user` shape and all services are preserved (Option D), Auth.js can land behind the same hook with no behavioral change to any downstream code; rollback is a git revert of the hook + login/logout + auth.ts.

---

## 9. Test impact

| Test | Impact | Why |
|---|---|---|
| `loginValidation.test.ts` | **Unchanged** (if `hashPassword`/`verifyUserCredentials` stay in `auth.ts`/`loginValidation.ts`) | Tests pure bcrypt logic, no session/cookie |
| `e2e/login.spec.ts` | **Review + likely minor edits** | Flows must still pass: login → `/dashboard`, wrong pw stays on `/login`, logout re-protects, session persists across reload. If login stays a form action (recommended) and logout stays a GET that lands on `/login`, these pass as-is; only cookie-name or redirect assertions would change |
| `transactions/categories/lending/recurring/networth/…` unit tests | **Unchanged** | Mock `getDrizzle()`/services; take `userId` as an argument; never touch auth |
| `apiLendings.test.ts` | **Unchanged** | Constructs `makeLocals({ userId })` directly |
| `verify-drizzle.neon.test.ts` | **Unchanged** | Opt-in (`VERIFY_NEON=1`), DB-only |
| **New tests needed** | Add | `authorize()` unit tests (valid/invalid creds, unknown user, null return), session-callback `userId` mapping test, hook redirection test |

The brief's directive holds: redesign test infrastructure **only after** the Auth.js architecture is settled.

---

## 10. Environment variables

| Variable | Current usage | After migration |
|---|---|---|
| `DATABASE_URL` | Canonical Neon/Postgres connection | **Unchanged** |
| `POSTGRES_URL` | Deprecated alias | Candidate for removal; keep for now |
| `LOCAL_DEV_DATABASE_URL` | Dev-only wiring in `loadEnv.ts` | **Unchanged** |
| `JWT_SECRET` | Signs/verifies session JWTs; startup guard | **Retire** (Auth.js uses `AUTH_SECRET`) |
| `AUTH_SECRET` | — | **Add (mandatory)** — encrypts Auth.js session cookie |
| `AUTH_TRUST_HOST` / `AUTH_URL` | — | **Add for Vercel prod** host verification |
| `SEED_DEMO` | e2e seeding gate | **Unchanged** |
| `NODE_ENV` | cookie `secure` flag | **Unchanged** |
| `SQLITE_PATH`, `DEMO_TODAY` | legacy seed-script refs | Already inert |

`JWT_SECRET` retirement is safe because password hashing needs no secret — only the session cookie did. The hooks startup guard (throw if DB configured but no secret) must be updated to check `AUTH_SECRET` instead. `.env`/`.env.example` were **not** modified; values are not printed here.

---

## 11. Migration boundaries

**Must change for Auth.js**

- `src/auth.ts` (new — `SvelteKitAuth` config, Credentials provider)
- `src/hooks.server.ts` (compose Auth.js `handle` via `sequence()`; keep route protection + `locals.user` population; update env guard to `AUTH_SECRET`)
- `src/lib/auth.ts` (drop `createToken`/`verifyToken`/`jsonwebtoken`; **keep** `hashPassword`/`verifyPassword`)
- `src/routes/login/+page.server.ts` (call `auth.api.signIn('credentials', …)` inside the existing form action — preserves `fail()`/`use:enhance` UX)
- `src/routes/logout/+server.ts` (Auth.js sign-out)
- `package.json` (+`@auth/sveltekit`; later −`jsonwebtoken`)
- `.env` / Vercel project settings (+`AUTH_SECRET`, +`AUTH_TRUST_HOST`)

**Should remain unchanged**

- `users` table + `password_hash` format; all `$lib/server/*` services (userId-scoped); all `+page.server.ts` loads/actions after `locals.user`; all `+server.ts` handlers; `App.Locals.user` shape; `src/lib/database/*`; `loginValidation.ts`; all UI; all routes.

**Potentially deprecated**

- `jsonwebtoken`, `JWT_SECRET`, `POSTGRES_URL`, legacy `session` cookie, `createToken`/`verifyToken`.

**Requires schema migration**

- **None** (Option D — JWT strategy, no adapter).

**Requires test migration**

- `e2e/login.spec.ts` review + new `authorize()`/session tests (§9).

**Requires UI changes**

- **None** — the login form, error rendering, and `use:enhance` behavior are preserved (sign-in is still a form POST).

**Requires environment changes**

- `AUTH_SECRET` (mandatory) + `AUTH_TRUST_HOST` (Vercel).

---

## 12. Do-not-implement confirmation

Nothing was implemented. No packages installed (`@auth/*` are not in `node_modules`/`package-lock`), no files modified, no schema/tests/UI/routes touched, no commits. The phases in §13 are **not** executed.

---

## 13. Final recommendation

**1. Current authentication architecture.** SvelteKit form-action login → bcrypt verify → **stateless JWT** (jsonwebtoken, 7d) in an httpOnly `session` cookie → global hooks-based route protection → `event.locals.user = { userId, username }` → all server reads go through userId-scoped `$lib/server/*` services. Logout deletes the cookie. No DB sessions, no roles, no registration, no password reset.

**2. Current user/password architecture.** `users(id serial, username unique, password_hash, created_at)`. Bcrypt `$2b$10$` hashes via bcryptjs, sync `compareSync` verification. Username is the sole identifier; no email anywhere.

**3. Current session architecture.** Stateless signed JWT cookie (`session`), verified per request by `jwt.verify`, 7-day expiry, single source of truth in hooks.

**4. Current authorization architecture.** Two layers: (a) global hook gates every route except `/login`; (b) every service query is ownership-scoped by the `userId` argument. No role-based auth.

**5. Current database/auth schema.** Single `users` table as above; five child tables FK to `users(id)` (integer, `ON DELETE CASCADE`). Drizzle schema ([src/lib/database/schema.ts](src/lib/database/schema.ts)) matches the live DDL ([src/lib/database/init.ts](src/lib/database/init.ts)); baseline migration `drizzle/0000_sad_freak.sql`.

**6. Auth.js compatibility assessment.**

- **Version/stack compatible:** `@auth/sveltekit` 1.11.3 works with SvelteKit 2.70 / Svelte 5 / TS 6; Drizzle + Neon are supported.
- **Credentials provider is a good fit** — the app already owns user lookup + bcrypt verification, which `authorize()` must do anyway.
- **JWT session strategy requires zero schema change** and mirrors today's stateless model.
- **The adapter is a poor fit** for a username-only, integer-ID, Credentials-only app (would add `email` + three tables with no user-management feature behind them).
- **⚠️ Ecosystem risk:** Auth.js is now maintained under **Better Auth** (official docs). Security patches continue, but the docs steer new work toward Better Auth. This should be an explicit go/no-go decision by the project owner — the migration plan below is identical in shape if the decision later flips to Better Auth, since both are drop-in `handle`-based SvelteKit integrations over the same Credentials/JWT model.

**7. Recommended Auth.js architecture (Option D).**

```ts
// src/auth.ts
SvelteKitAuth({
  providers: [Credentials({
    authorize: lookup user + verifyPassword
  })],
  session: { strategy: 'jwt' },
  callbacks: {
    session: map session.user.id (string) → userId (number),
                      name → username
  }
})

// hooks.server.ts
export const handle = sequence(authHandle, protectionHandle)
// protectionHandle:
//   root → /dashboard; '/login' public;
//   session = await event.locals.auth()
//   if (!session?.user) 302 /login
//   else event.locals.user = { userId: session.user.userId,
//                              username: session.user.username }
```

No adapter, no schema migration, `App.Locals.user` preserved → all 80+ call sites and every service stay untouched.

**8. Required schema changes.** **None.**

**9. Required source-file changes.** New `src/auth.ts`; edit `hooks.server.ts`, `lib/auth.ts` (trim), `login/+page.server.ts`, `logout/+server.ts`, `app.d.ts` (optional — keep `user` shape), `package.json`.

**10. Required environment changes.** Add `AUTH_SECRET` (+`AUTH_TRUST_HOST` on Vercel); retire `JWT_SECRET`; keep `DATABASE_URL`, `LOCAL_DEV_DATABASE_URL`, `SEED_DEMO`, `NODE_ENV`.

**11. Expected session migration behavior.** One-time forced re-login for all users; old `session` cookie ignored (delete it in handlers); no bridge, no DB session port, no data loss; fully reversible via git revert.

**12. Expected test impact.** `loginValidation.test.ts` and all service/API unit tests unaffected; `e2e/login.spec.ts` reviewed with likely-minor edits; new `authorize()` + session-mapping + hook-redirect tests added.

**13. Risks.**

- **Auth.js maintenance status** (Better Auth takeover) — mitigated: security patches continue; Option D's seam makes a later flip to Better Auth cheap.
- **Forced re-login** on rollout — one-time, acceptable.
- **`userId` type mapping** (Auth.js string id → integer FK) — contained entirely in the session callback; must be tested.
- **Brute-force protection** for Credentials remains the app's responsibility (unchanged from today).
- **Future OAuth/sign-up** would require an `email` column — out of scope now, note for later.

**14. Proposed implementation phases** (not executed):

- **Auth-1 — Dependencies + Auth.js foundation:** install `@auth/sveltekit`; add `AUTH_SECRET` (+`AUTH_TRUST_HOST`) to `.env`/`.env.example`/Vercel; empty `src/auth.ts` wired into hooks; verify boot + existing login still works.
- **Auth-2 — Auth.js configuration:** Credentials provider with `authorize()` (lookup + `verifyPassword`), JWT session strategy, session callback mapping `{ userId, username }`; confirm `loginValidation.test.ts` stays green.
- **Auth-3 — Database/session integration:** decide/confirm **no adapter, no schema change**; validate against Neon (reuse `verify-drizzle.neon`-style harness); confirm hashes verify via `authorize()`.
- **Auth-4 — Login/session migration:** rewire login form action → `auth.api.signIn('credentials', …)` preserving `fail()`/`use:enhance`; rewire logout → sign-out; delete legacy `session` cookie; retire `createToken`/`verifyToken`.
- **Auth-5 — Protected routes/server integration:** `sequence(authHandle, protectionHandle)`; populate `locals.user` from session; update the hooks env guard to `AUTH_SECRET`; verify all 80+ `locals.user!.userId` sites + API routes unchanged.
- **Auth-6 — Tests:** update `e2e/login.spec.ts`; add `authorize()`/session-callback/hook tests; run `check`, `lint`, `test:unit`.
- **Auth-7 — Verification + cleanup:** remove `jsonwebtoken` dependency; delete dead auth code; manual smoke of login/logout/refresh on Vercel preview; document in CLAUDE.md.

---

**STOP — survey complete. No implementation performed.**
