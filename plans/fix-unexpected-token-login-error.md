# Plan: Fix "Unexpected token '<'" Error After Login

## Context

**Bug:** When a user logs out, visits the root route `/`, then logs in — they get:
```
Unexpected token '<', "<!doctype "... is not valid JSON
```

This is a classic SPA auth race condition. The "Unexpected token '<'" means a `fetch()` call received HTML (the login redirect page) instead of JSON. In SvelteKit, this typically happens when:

1. `use:enhance` on the login form submits the action
2. The action returns a redirect to `/dashboard`
3. SvelteKit makes an **internal fetch** to `/dashboard` to load the new page's data
4. That fetch goes to the server **without the session cookie** (HTTP-only cookie, or fetch not configured with `credentials`)
5. The hooks redirect to `/login`
6. The fetch receives HTML instead of JSON
7. `JSON.parse()` on HTML throws "Unexpected token '<'"

### Root Cause Candidates

1. **SvelteKit internal fetch missing cookie** — SvelteKit uses `fetch` internally to load the next page's `load` function. If the session cookie is `httpOnly: true`, SvelteKit's internal fetch may not include it, causing the hooks to see no session and redirect to `/login`.

2. **Service Worker caching** — `dev-dist/sw.js` may be registered and intercepting requests, serving stale responses.

3. **Cookie `sameSite` issue** — `sameSite: 'lax'` works for browser navigation but may not be sent with SvelteKit's internal fetch requests.

## Root Cause Found: Service Worker

The network tab shows the correct redirect response:
```json
{"type":"redirect","status":302,"location":"/dashboard"}
```

So the login redirect itself works fine. The "Unexpected token '<'" error happens during the **subsequent navigation to /dashboard** — the Service Worker intercepts the request and returns stale HTML.

**Evidence:** [vite.config.ts](../vite.config.ts) configures `SvelteKitPWA` with:
- `registerType: 'autoUpdate'` — auto-registers the SW
- `devOptions.enabled: true` — SW active in dev mode
- `workbox.runtimeCaching` — intercepts `/api/` and general asset requests
- `workbox.globPatterns` — caches `**/*.{js,css,html,...}`

When the browser navigates from `/login` to `/dashboard`, the SW intercepts the data-fetch request. Since there's no `navigateFallbackDenylist` for SvelteKit's internal `__data.json` URLs, the SW can serve stale/cached HTML for what should be a JSON response.

## Fix (Implemented)

### 1. Disable Service Worker in Dev Mode

**File:** `vite.config.ts`

Changed `devOptions.enabled: true` → `false`. The SW is not needed during development and was interfering with SvelteKit's data-fetch pipeline.

### 2. Use `redirect()` in Login Action (Already Done)

**File:** `src/routes/login/+page.server.ts`

Changed from `return { success: true, redirect: '/dashboard' }` to `redirect(302, '/dashboard')`.

### 3. Use `redirect()` in hooks.server.ts (Already Done)

**File:** `src/hooks.server.ts`

Changed from `new Response(null, { status: 302, ... })` to `redirect()` for both root `/` → `/dashboard` and unauthenticated → `/login` redirects.

## Verification

1. `npm run dev` — SW will not register
2. Open DevTools → Application → Service Workers — no active SW
3. Log out → visit `/` → log in
4. No JSON parse error
5. Dashboard loads correctly