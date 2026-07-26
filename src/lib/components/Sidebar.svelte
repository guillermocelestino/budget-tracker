<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
		{ href: '/transactions', label: 'Transactions', icon: 'creditcard' },
		{ href: '/lending', label: 'Lending', icon: 'lending' },
		{ href: '/categories', label: 'Categories', icon: 'tags' },
		{ href: '/reports', label: 'Reports', icon: 'chart' },
	];

	let mobileOpen = $state(false);
	let collapsed = $state(false);

	onMount(() => {
		const saved = localStorage.getItem('sidebar-collapsed');
		if (saved === 'true') {
			collapsed = true;
			document.documentElement.style.setProperty('--sidebar-width', '72px');
		}
	});

	function toggleCollapse() {
		collapsed = !collapsed;
		document.documentElement.style.setProperty(
			'--sidebar-width',
			collapsed ? '72px' : '260px'
		);
		localStorage.setItem('sidebar-collapsed', String(collapsed));
	}

	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}
</script>

<button class="mobile-toggle" onclick={() => mobileOpen = !mobileOpen} aria-label="Toggle navigation" aria-expanded={mobileOpen}>
	<span class="hamburger"></span>
</button>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape' && mobileOpen) mobileOpen = false; }} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<aside class="sidebar" class:open={mobileOpen} class:collapsed>
	<!-- Logo/Brand -->
	<div class="sidebar-header">
		<div class="logo-container">
			<div class="logo-icon">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2v20M6 4h7a4 4 0 0 1 0 8H6" /><line x1="4" x2="18" y1="12" y2="12" /><line x1="4" x2="18" y1="16" y2="16"/>
				</svg>
			</div>
		</div>
		{#if !collapsed}
			<div class="brand-text">
				<h2>Budget Tracker</h2>
				<span class="brand-tagline">Smart Finance</span>
			</div>
		{/if}
	</div>

	<!-- User Profile -->
	<div class="user-profile">
		<div class="user-avatar">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
				<circle cx="12" cy="7" r="4"/>
			</svg>
		</div>
		{#if !collapsed}
			<div class="user-info">
				<span class="user-name">Guest User</span>
				<span class="user-email">Manage your finances</span>
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<nav class="sidebar-nav">
		{#each navItems as item}
			<a
				href={item.href}
				class="nav-item"
				class:active={isActive(item.href)}
				title={collapsed ? item.label : undefined}
			>
				<div class="nav-indicator"></div>
				<span class="nav-icon">
					{#if item.icon === 'dashboard'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect width="7" height="9" x="3" y="3" rx="1"/>
							<rect width="7" height="5" x="14" y="3" rx="1"/>
							<rect width="7" height="9" x="14" y="12" rx="1"/>
							<rect width="7" height="5" x="3" y="16" rx="1"/>
						</svg>
					{:else if item.icon === 'creditcard'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect width="20" height="14" x="2" y="5" rx="2"/>
							<path d="M2 10h20"/>
						</svg>
					{:else if item.icon === 'tags'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
							<path d="M7 7h.01"/>
						</svg>
					{:else if item.icon === 'lending'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="m20.42 4.58-7.65 7.65-2.12-2.12a1.5 1.5 0 0 0-2.12 2.12l3.54 3.54a1.5 1.5 0 0 0 2.12-2.12L12 12"/>
							<path d="m8.58 15.42-3.54 3.54"/>
							<path d="m15.42 8.58 3.54-3.54"/>
						</svg>
					{:else if item.icon === 'chart'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 3v18h18"/>
							<path d="M18 17V9"/>
							<path d="M13 17V5"/>
							<path d="M8 17v-3"/>
						</svg>
					{/if}
				</span>
				{#if !collapsed}
					<span class="nav-label">{item.label}</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Footer -->
	<div class="sidebar-footer">
		<button class="collapse-btn" onclick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
			<span class="collapse-icon" class:rotated={collapsed}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m15 18-6-6 6-6"/>
				</svg>
			</span>
			{#if !collapsed}
				<span class="nav-label">Collapse</span>
			{/if}
		</button>

		<a href="/logout" class="logout-link">
			<span class="logout-icon">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
					<polyline points="16 17 21 12 16 7"/>
					<line x1="21" x2="9" y1="12" y2="12"/>
				</svg>
			</span>
			{#if !collapsed}
				<span class="nav-label">Logout</span>
			{/if}
		</a>

		{#if !collapsed}
			<div class="version-badge">v0.1.0</div>
		{/if}
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
		border-radius: var(--radius-md);
		padding: 10px;
		cursor: pointer;
		min-width: 44px;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		box-shadow: var(--shadow-sm);
	}

	.hamburger,
	.hamburger::before,
	.hamburger::after {
		display: block;
		width: 22px;
		height: 2px;
		background: var(--color-text);
		border-radius: 2px;
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
		background: linear-gradient(180deg, var(--color-surface) 0%, rgba(255, 255, 255, 0.95) 100%);
		backdrop-filter: blur(20px);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		z-index: 90;
		transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
		box-shadow: 4px 0 20px rgba(0, 0, 0, 0.05);
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-lg);
		border-bottom: 1px solid var(--color-border);
		min-height: 80px;
	}

	.logo-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
		border-radius: var(--radius-md);
		flex-shrink: 0;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
	}

	.logo-icon {
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.brand-text h2 {
		font-size: var(--font-size-base);
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
		line-height: 1.2;
	}

	.brand-tagline {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
	}

	.user-profile {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		margin: var(--space-md);
		background: var(--color-bg);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		transition: all var(--transition-fast);
	}

	.user-avatar {
		width: 40px;
		height: 40px;
		background: linear-gradient(135deg, var(--color-primary-light) 0%, #e0e7ff 100%);
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.user-info {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.user-name {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-email {
		font-size: var(--font-size-xs);
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sidebar-nav {
		flex: 1;
		padding: var(--space-sm) var(--space-sm);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.nav-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: 12px var(--space-md);
		color: var(--color-text);
		text-decoration: none;
		font-size: var(--font-size-sm);
		min-height: 48px;
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
		overflow: hidden;
	}

	.nav-indicator {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%) scaleY(0);
		width: 3px;
		height: 24px;
		background: linear-gradient(180deg, var(--color-primary) 0%, #8b5cf6 100%);
		border-radius: 0 2px 2px 0;
		transition: transform 200ms ease;
	}

	.nav-item:hover {
		background: var(--color-bg);
	}

	.nav-item:hover .nav-icon {
		color: var(--color-primary);
		transform: scale(1.05);
	}

	.nav-item.active {
		background: linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%);
		color: var(--color-primary);
		font-weight: 600;
	}

	.nav-item.active .nav-indicator {
		transform: translateY(-50%) scaleY(1);
	}

	.nav-item.active .nav-icon {
		color: var(--color-primary);
	}

	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
	}

	.nav-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: opacity 200ms ease;
	}

	.collapsed .nav-label {
		opacity: 0;
		width: 0;
	}

	.collapsed .nav-item {
		justify-content: center;
		padding: 12px;
	}

	.sidebar-footer {
		padding: var(--space-md);
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.collapse-btn {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		background: none;
		border: none;
		cursor: pointer;
		padding: 10px var(--space-md);
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
		font-family: inherit;
		transition: all var(--transition-fast);
		white-space: nowrap;
		border-radius: var(--radius-md);
		min-height: 44px;
	}

	.collapse-btn:hover {
		background: var(--color-bg);
		color: var(--color-text);
	}

	.collapse-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 300ms ease;
	}

	.collapse-icon.rotated {
		transform: rotate(180deg);
	}

	.logout-link {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		color: var(--color-text-secondary);
		font-size: var(--font-size-sm);
		text-decoration: none;
		padding: 10px var(--space-md);
		transition: all var(--transition-fast);
		white-space: nowrap;
		border-radius: var(--radius-md);
		min-height: 44px;
	}

	.logout-link:hover {
		background: linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
		color: var(--color-expense);
	}

	.logout-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform var(--transition-fast);
	}

	.logout-link:hover .logout-icon {
		transform: translateX(-2px);
	}

	.version-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 4px 10px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text-secondary);
		width: fit-content;
		margin-top: var(--space-sm);
	}

	.sidebar-overlay {
		display: none;
	}

	/* Mobile Styles */
	@media (max-width: 768px) {
		.mobile-toggle {
			display: flex;
		}

		.sidebar {
			transform: translateX(-100%);
			width: 280px !important;
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.collapsed .nav-label,
		.collapsed .brand-text {
			opacity: 1;
			width: auto;
		}

		.collapsed .nav-item {
			justify-content: flex-start;
			padding: 12px var(--space-md);
		}

		.user-profile,
		.version-badge {
			display: flex;
		}

		.sidebar-overlay {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.4);
			backdrop-filter: blur(4px);
			z-index: 89;
		}

		.sidebar-header {
			min-height: auto;
			padding: var(--space-md);
		}

		.user-profile {
			margin: var(--space-sm);
		}
	}
</style>