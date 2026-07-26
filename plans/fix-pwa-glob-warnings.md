# Plan: Fix PWA Workbox Glob Pattern Warnings

## Context
The PWA workbox generates warnings during `vite dev` because `globPatterns` in `vite.config.ts` reference paths (`prerendered/_`, `client/_`) that only exist in the production build output, not in `dev-dist/` (which is the dev output directory). The `dev-dist/` directory only contains `sw.js` and `workbox-*.js` — no subdirectories.

## File to Modify
`src/vite.config.ts` (or `vite.config.ts` at project root)

## Change
Simplify the `workbox.globPatterns` to only match the broad file extension pattern. Remove the non-existent directory references.

**Current (lines ~45-52):**
```typescript
globPatterns: [
    '**/*.{js,css,html,ico,png,svg,woff2}',
    'prerendered/_',
    'client/_'
],
```

**Change to:**
```typescript
globPatterns: [
    '**/*.{js,css,html,ico,png,svg,woff2}'
],
```

Also ensure `globIgnores` properly excludes the generated service worker files:

**Current:**
```typescript
globIgnores: ['**/node_modules/**/*'],
```

**Change to:**
```typescript
globIgnores: [
    '**/node_modules/**/*',
    'dev-dist/sw.js',
    'dev-dist/workbox-*.js'
],
```

## Alternative (if using default patterns)
If `@vite-pwa/sveltekit` should handle glob patterns automatically, remove the custom `globPatterns` entirely and let the plugin use its built-in defaults.

```typescript
workbox: {
    // Remove globPatterns entirely — plugin uses its own defaults
    globIgnores: [
        '**/node_modules/**/*',
        'dev-dist/sw.js',
        'dev-dist/workbox-*.js'
    ],
    runtimeCaching: [... existing caching rules ...]
}
```

## Verification
1. Run `npm run dev`
2. Confirm the warnings about `prerendered/_`, `client/_`, and no matching files are gone
3. Confirm PWA still caches correctly in production build