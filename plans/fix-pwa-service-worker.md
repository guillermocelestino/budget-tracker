# Plan: Fix PWA Service Worker for Production

## Context

The PWA was previously broken by:
1. **Dev mode PWA enabled** — registered a service worker during development, which cached old pages
2. **Temporary fix in `app.html`** — we added JavaScript to unregister any service worker and clear caches, which killed PWA entirely
3. **Duplicate PWA registrations** — dev mode created multiple SW registrations that conflicted

The result: the PWA doesn't work at all right now on mobile or in production builds.

## Root Cause Analysis

The core problem was **dev mode PWA**. Service workers should NEVER be active during development — they cache old code, interfere with hot reload, and cause the exact caching nightmare we experienced.

## Solution

### Principle: PWA only in production, never in dev

- **Development (`npm run dev`)**: No service worker registered. No caching. Full hot-reload works.
- **Production (`npm run build` + deploy)**: Service worker registers. PWA installable on mobile. Smart caching only for static assets.

### Files to Modify

### 1. `src/app.html` — Remove SW unregistration code

Remove lines 13-26 (the `<script>` that unregisters SW and clears caches). This was a temporary emergency fix. In production, we WANT the SW to work.

**Keep:** The PWA meta tags (`apple-mobile-web-app-capable`, manifest link, theme-color, etc.) — these are needed for the install prompt and mobile display.

### 2. `vite.config.ts` — Update PWA config

**Keep:**
- `devOptions.enabled: false` — no SW in dev mode (critical)
- `registerType: 'autoUpdate'` — SW auto-updates on new deploy
- `includeAssets` — icon assets
- `manifest` — app name, icons, display settings

**Change:**
- `start_url` from `'/'` to `'/dashboard'` — avoids the hooks redirect chain (root redirects to /dashboard). Direct launch to dashboard is faster and avoids SW navigation issues.

**Workbox caching strategy:**
- Remove `globPatterns` (let workbox use defaults)
- Remove `globIgnores` (defaults are fine)
- Add smarter runtime caching:
  - `NetworkFirst` for API routes (always try network, fallback to cache) — keep existing
  - `StaleWhileRevalidate` for navigation/page requests (serve cached HTML immediately, update in background)
  - `CacheFirst` for static assets (JS, CSS, fonts, images) — they're versioned by Vite

```typescript
workbox: {
    runtimeCaching: [
        {
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                networkTimeoutSeconds: 10,
            },
        },
        {
            urlPattern: /^\/dashboard|\/transactions|\/categories|\/reports|\/login/,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'page-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
        },
    ],
},
```

### 3. PWA Icons — Verify they exist

The manifest references `icon-192.png` and `icon-512.png` in the `static/` folder. These must exist for the install prompt to work. If missing, PWA won't be installable.

Check `static/icon-192.png`, `static/icon-512.png`, `static/icon.svg`.

### How to Test (Production Build)

```bash
npm run build
npm run preview
```

Open `http://localhost:4173` (preview server). The service worker should register. You should see the PWA install prompt in the address bar. On mobile, "Add to Home Screen" should work.

### How Development Continues to Work

```bash
npm run dev
```

No SW. No caching. Hot reload works. No stale cache issues.

### If Caching Issues Reappear (Emergency)

If a production SW ever caches stale content:
1. Open Chrome DevTools → Application → Service Workers → Unregister
2. Application → Clear storage → Clear site data
3. Reload

Then rebuild and redeploy with the fix.

## Verification

1. **Dev mode**: `npm run dev` → no SW registered in DevTools → no caching → hot reload works
2. **Production build**: `npm run build && npm run preview` → SW registers → PWA install prompt appears
3. **Mobile**: Open production URL on phone → "Add to Home Screen" → app opens without browser chrome
4. **Page navigation**: Click around the app → pages load fresh (NetworkFirst) → no stale content
5. **App install prompt**: On desktop Chrome, the install icon appears in the address bar
