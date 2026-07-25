# Fix Logout Not Working

## Context

The `/logout` route has a `+page.server.ts` but no `+page.svelte` — it's a page route missing its required component, so SvelteKit won't route to it. The logout link in the sidebar navigates to `/logout` and nothing happens.

## Fix

Replace `src/routes/logout/+page.server.ts` with `src/routes/logout/+server.ts` (API route). API routes handle GET requests via a `GET` export and can set cookies + redirect properly without needing a page component.

**Current file**: `src/routes/logout/+page.server.ts`

```ts
import { redirect } from '@sveltejs/kit';

export function load({ cookies }) {
    cookies.delete('session', { path: '/' });
    redirect(302, '/login');
}
```

**Replace with**: `src/routes/logout/+server.ts`

```ts
import { redirect } from '@sveltejs/kit';

export function GET({ cookies }) {
    cookies.delete('session', { path: '/' });
    redirect(302, '/login');
}
```

Also ensure the cookie delete options match how it was set (add `httpOnly`, `sameSite`, `secure` so the deletion works in production with HTTPS):

```ts
cookies.delete('session', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
});
```

This is the standard SvelteKit pattern for a logout endpoint — the sidebar `<a href="/logout">` makes a GET request, the server deletes the cookie and returns a 302 redirect to `/login`, which the browser follows.

## File Changes

| File | Action |
|------|--------|
| `src/routes/logout/+page.server.ts` | Delete |
| `src/routes/logout/+server.ts` | Create |

## Verification

1. `npm run dev`
2. Login with the app
3. Click "🚪 Logout" in the sidebar
4. Verify it redirects to `/login` and shows the login form
5. Verify that navigating back to `/` redirects to `/login` (session cleared)
