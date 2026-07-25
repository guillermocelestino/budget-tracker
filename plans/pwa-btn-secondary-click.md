# Plan: `pwa-btn-secondary` Click Does Nothing

## Context

The user reports that clicking `pwa-btn` and `pwa-btn-secondary` in the PWA toast does nothing. The buttons are rendered by `PwaUpdate.svelte`, which uses the `@vite-pwa/sveltekit` plugin's `useRegisterSW` hook to manage the service worker lifecycle.

## What the Buttons Actually Do

There are two possible toasts, controlled by `$needRefresh` and `$offlineReady` stores from `virtual:pwa-register/svelte`:

| Button | Condition | Label | Action |
|---|---|---|---|
| `pwa-btn pwa-btn-primary` | `$needRefresh` is true | "Refresh" | `updateServiceWorker(true)` — reloads page with new version |
| `pwa-btn pwa-btn-secondary` | `$needRefresh` is true | "Dismiss" | `updateServiceWorker(false)` — dismisses toast, keeps old version |
| `pwa-btn pwa-btn-secondary` | `$offlineReady` is true | "Got it" | `updateServiceWorker(false)` — dismisses "ready offline" toast |

## Root Cause Analysis

**If nothing happens on click, the most likely root causes are:**

1. **Svelte 5 store compatibility issue** — the project uses **Svelte 5.56.1**, but `PwaUpdate.svelte` uses Svelte 4 patterns: `onclick={handler}` (Svelte 4 HTML attribute style), `{#if $needRefresh}` (store auto-subscription), and `const { ... } = useRegisterSW()` with no reactive wrapping. Svelte 5's event handling on HTML elements (`onclick`) should work, but the issue likely lies in **how `useRegisterSW` returns reactive stores** and whether `$needRefresh` / `$offlineReady` are properly subscribed to in the Svelte 5 context.
2. **The `$offlineReady` or `$needRefresh` store never becomes `true`** in the current session — the toast may simply not be showing.
3. **`updateServiceWorker(false)` from `@vite-pwa/sveltekit` is not reactive** — calling it sets internal plugin state, but the Svelte stores aren't being reset, so the toast doesn't visually disappear on click.

## Files Involved

- [src/lib/components/PwaUpdate.svelte](src/lib/components/PwaUpdate.svelte) — primary source; buttons at lines 25, 26, 38; `onclick` handlers at lines 6-12
- [vite.config.ts](vite.config.ts) — PWA plugin config (`registerType: 'autoUpdate'`)
- [dev-dist/sw.js](dev-dist/sw.js) — generated Workbox service worker

## Proposed Investigation & Fix

1. **Check the Svelte version of `vite-plugin-pwa`** — the `virtual:pwa-register/svelte` module must support Svelte 5 reactive system. If the plugin hasn't been updated for Svelte 5, its stores (`needRefresh`, `offlineReady`) won't be reactive in this context.

2. **Add `console.log` debugging** in `PwaUpdate.svelte`:
   ```ts
   function handleDismiss() {
       console.log('handleDismiss called', { needRefresh: $needRefresh, offlineReady: $offlineReady });
       updateServiceWorker(false);
   }
   ```
   If the log never appears, the `onclick` binding itself is broken.

3. **Convert to Svelte 5 runes syntax** as the fix:
   - Import `onMount` from `svelte` and wrap the `useRegisterSW()` call in `onMount` to ensure it's only called client-side
   - Use `$state` for local reactive state derived from the stores
   - Use `onclick` (Svelte 5 event handler) instead of the `onclick={}` attribute if needed
   - Example fix pattern:
     ```ts
     import { onMount } from 'svelte';
     onMount(() => {
         const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();
         // Subscribe to stores and store values in $state
     });
     ```

4. **Verify service worker is registered** — open DevTools → Application → Service Workers to confirm one is active.

## Verification

- Run the app in dev mode: `npm run dev`
- Open DevTools → Application → Service Workers — confirm a SW is registered
- Add `console.log` to `handleDismiss`/`handleRefresh` and click the button — watch console
- Watch the `$needRefresh` / `$offlineReady` values in DevTools or via logging