<script lang="ts">
	import { page } from '$app/stores';

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: '📊' },
		{ href: '/transactions', label: 'Transactions', icon: '💳' },
		{ href: '/categories', label: 'Categories', icon: '🏷️' },
		{ href: '/reports', label: 'Reports', icon: '📈' },
	];

	let mobileOpen = $state(false);

	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}
</script>

<button class="mobile-toggle" onclick={() => mobileOpen = !mobileOpen} aria-label="Toggle navigation">
	<span class="hamburger"></span>
</button>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<aside class="sidebar" class:open={mobileOpen} onclick={() => mobileOpen = false}>
	<div class="sidebar-header">
		<h2 class="sidebar-logo">💰 Budget Tracker</h2>
	</div>

	<nav class="sidebar-nav">
		{#each navItems as item}
			<a
				href={item.href}
				class="nav-item"
				class:active={isActive(item.href)}
			>
				<span class="nav-icon">{item.icon}</span>
				<span class="nav-label">{item.label}</span>
			</a>
		{/each}
	</nav>

	<div class="sidebar-footer">
		<a href="/logout" class="logout-link">🚪 Logout</a>
		<small>v0.1.0</small>
	</div>
</aside>

{#if mobileOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
	<div class="sidebar-overlay" onclick={() => mobileOpen = false}></div>
{/if}

<style>
	.mobile-toggle {
		display: none;
		position: fixed;
		top: var(--space-sm);
		left: var(--space-sm);
		z-index: 100;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 12px;
		cursor: pointer;
		min-width: 44px;
		min-height: 44px;
		align-items: center;
		justify-content: center;
	}

	.hamburger,
	.hamburger::before,
	.hamburger::after {
		display: block;
		width: 22px;
		height: 2px;
		background: var(--color-text);
		border-radius: 2px;
	}

	.hamburger {
		position: relative;
	}

	.hamburger::before,
	.hamburger::after {
		content: '';
		position: absolute;
		left: 0;
	}

	.hamburger::before {
		top: -7px;
	}

	.hamburger::after {
		top: 7px;
	}

	.sidebar {
		position: fixed;
		top: 0;
		left: 0;
		width: var(--sidebar-width);
		height: 100vh;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		z-index: 90;
		transition: transform var(--transition-normal);
	}

	.sidebar-header {
		padding: var(--space-lg);
		border-bottom: 1px solid var(--color-border);
	}

	.sidebar-logo {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-primary);
	}

	.sidebar-nav {
		flex: 1;
		padding: var(--space-md) 0;
		overflow-y: auto;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 12px var(--space-lg);
		color: var(--color-text);
		text-decoration: none;
		font-size: var(--font-size-base);
		min-height: 48px;
		transition: background var(--transition-fast), color var(--transition-fast);
	}

	.nav-item:hover {
		background: var(--color-primary-light);
	}

	.nav-item.active {
		background: var(--color-primary-light);
		color: var(--color-primary);
		font-weight: 600;
	}

	.nav-icon {
		font-size: 1.25rem;
		width: 24px;
		text-align: center;
	}

	.sidebar-footer {
		padding: var(--space-md) var(--space-lg);
		border-top: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.logout-link {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
		text-decoration: none;
		padding: 6px 0;
		transition: color var(--transition-fast);
	}

	.logout-link:hover {
		color: var(--color-expense);
		text-decoration: none;
	}

	.sidebar-overlay {
		display: none;
	}

	@media (max-width: 768px) {
		.mobile-toggle {
			display: flex;
		}

		.sidebar {
			transform: translateX(-100%);
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-overlay {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.3);
			z-index: 89;
		}
	}
</style>
