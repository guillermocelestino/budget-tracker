# Plan: Hide Sidebar on Root Route for Unauthenticated Users

## Context
Currently, unauthenticated users are redirected from `/` to `/login` by `hooks.server.ts` before the layout ever renders, so they never see the sidebar. However, the user wants `/` to behave like `/login` regarding sidebar visibility — if an unauthenticated user somehow reaches `/` (or if `/` becomes a public page), the sidebar should be hidden.

The current layout sidebar logic is purely pathname-based (`pathname === '/login'`). This needs to become auth-aware.

## Files to Modify

### 1. `src/routes/+layout.server.ts`
Expose auth state to the page data so the layout can react to it.

**Add to existing load function:**
```typescript
export const load = async ({ locals }) => {
    return {
        user: locals.user ?? null,
    };
};
```

### 2. `src/routes/+layout.svelte`
Update sidebar visibility to check auth state in addition to pathname.

**Current logic:**
```svelte
const isLoginPage = $derived($page.url.pathname === '/login');
```

**Change to:**
```svelte
const isLoginPage = $derived($page.url.pathname === '/login');
const isPublicRoute = $derived($page.url.pathname === '/' && !$page.data.user);
const showSidebar = $derived(!isLoginPage && !isPublicRoute);
```

Then update the sidebar conditional:
```svelte
{#if showSidebar}
    <Sidebar />
{/if}
```

Also update the CSS class logic for `no-sidebar` to include the public route:
```svelte
const pageClass = $derived(
    (isLoginPage || ($page.url.pathname === '/' && !$page.data.user)) ? 'no-sidebar' : ''
);
```

### 3. `src/hooks.server.ts` (optional)
If `/` should be publicly accessible (a landing page), remove it from auth protection. But if auth should still apply to `/`, no change needed here — the redirect already handles it.

## Verification
1. Run `npm run dev`
2. Without logging in, navigate to `/`
3. Confirm no sidebar appears
4. After logging in, navigate to `/` and confirm sidebar appears