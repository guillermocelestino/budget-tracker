# Plan: Hide Sidebar When Not Logged In

## Context

The root layout (`+layout.svelte`) currently renders the `Sidebar` component unconditionally on every page — including the `/login` page. This means users see an empty sidebar with no navigation items (since they aren't authenticated) on the login screen, which is confusing and unnecessary.

Since the only public/unauthenticated route is `/login`, hiding the sidebar on that page is the cleanest solution.

## Files to Modify

### 1. `src/routes/+layout.svelte`

**Current:** Always renders `<Sidebar />`.

**Change:** Conditionally render the sidebar based on the current route.

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	// ... existing imports ...

	const isLoginPage = $derived($page.url.pathname === '/login');
</script>

<!-- ... existing PwaUpdate and ToastContainer ... -->

<div class="app-shell">
	{#if !isLoginPage}
		<Sidebar />
	{/if}
	<div class="main-area" class:no-sidebar={isLoginPage}>
		<main class="main-content" class:navigating={$navigating}>
			{@render children()}
		</main>
	</div>
</div>
```

**CSS addition:** When the sidebar is hidden, remove the left margin so the content fills the full viewport width.

```css
.main-area.no-sidebar {
	margin-left: 0;
}

@media (max-width: 768px) {
	.main-area.no-sidebar {
		padding-top: 0;
	}
}
```

## How It Works

1. The layout watches `$page.url.pathname` — when it equals `/login`, `isLoginPage` is `true`
2. The `{#if !isLoginPage}` block skips the Sidebar on the login page
3. The `.no-sidebar` class removes the `margin-left: var(--sidebar-width)` and the mobile `padding-top: 48px` so login content fills the full viewport
4. All other routes (Dashboard, Transactions, Categories, Reports) continue to show the sidebar as before

## Edge Cases Considered

- **Logout redirect:** After logout, the user is redirected to `/login` — the sidebar disappears because the url becomes `/login`
- **Future public routes:** If another public route is added (e.g., `/register`, `/forgot-password`), just update the check to `['/login', '/register'].includes($page.url.pathname)`
- **Mobile:** The `padding-top: 48px` is also removed when there's no sidebar, since the hamburger button lives in the sidebar component
- **Layout shifts:** No flash of sidebar — it renders conditionally at the Svelte template level, not after mount

## Verification

1. Visit `/login` — sidebar should be hidden, content centered and full-width
2. Log in — redirects to `/` — sidebar appears with navigation
3. Resize to mobile viewport on `/login` — no sidebar overlay or hamburger button visible
4. Navigate between all authenticated pages — sidebar persists as expected
