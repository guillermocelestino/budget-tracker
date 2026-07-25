# Plan: Convert Budget Tracker to a PWA (Progressive Web App)

## Context

The budget tracker is a SvelteKit 5 full-stack app that is already mobile-friendly (responsive CSS, hamburger menu) but has **no PWA setup** — no manifest, no service worker, no installability. The user wants to be able to open the app on a mobile device and "install" it to the home screen, matching the native app feel.

## Approach

Use **`@vite-pwa/sveltekit`** — the official Vite PWA plugin for SvelteKit. It handles:
- Web manifest generation
- Service worker with Workbox (offline caching)
- Auto-update notifications
- "Add to Home Screen" prompt integration

This is the standard, well-maintained approach for SvelteKit PWAs.

---

## Steps

### 1. Install dependencies

```
npm install -D @vite-pwa/sveltekit
```

### 2. Configure `vite.config.ts`

Add the PWA plugin with a minimal but complete config:
- `manifest` object with name, short_name, theme_color, icons, display: "standalone"
- `workbox` strategy: **NetworkFirst** for navigation (so the app shell works offline), **CacheFirst** for assets
- `injectManifest` mode (not generate) since we need a custom service worker for SvelteKit's routing

### 3. Create `static/icon-512.png` and `static/icon-192.png`

Two PNG icons (512×512 and 192×192) — the user should provide their own icons. Include in manifest `icons` array.

### 4. Update `src/app.html`

Add PWA meta tags inside `%sveltekit.head%`:
- `theme-color` meta tag
- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`

### 5. Add PWA update toast component

Create a small `src/lib/components/PwaUpdate.svelte` that shows when a new service worker is available and the user can refresh to update.

### 6. Wire it into `+layout.svelte`

Import and render `<PwaUpdate />` in the layout so it's always present.

---

## Critical Files

| File | Change |
|---|---|
| `vite.config.ts` | Add `@vite-pwa/sveltekit` plugin |
| `src/app.html` | Add PWA meta tags |
| `static/` | Add `icon-192.png`, `icon-512.png` |
| `src/lib/components/PwaUpdate.svelte` | **New** — update notification component |
| `src/routes/+layout.svelte` | Import and render `<PwaUpdate />` |

## Verification

1. Run `npm run dev` — open Chrome DevTools → Application → Service Workers to confirm SW is registered
2. Check **Application → Manifest** to confirm all fields are correct (name, icons, theme_color, display: standalone)
3. Test "Add to Home Screen" in mobile Chrome/Safari — prompt should appear
4. Test offline: enable airplane mode, reload — app should still render