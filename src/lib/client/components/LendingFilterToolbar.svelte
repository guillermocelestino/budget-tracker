<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import DateFilterMenu from '$lib/client/components/DateFilterMenu.svelte';
	import LendingStatusFilterMenu from '$lib/client/components/LendingStatusFilterMenu.svelte';

	// ─── Props ────────────────────────────────────────────────────────
	let {
		value = $bindable(''),
		placeholder = 'Search borrower, lender, notes…',
		ariaLabel = 'Search lendings',
		counts = { all: 0, active: 0, paid: 0 },
		paidLabel = 'Paid',
		activeFilters = { status: 'active', date: '', customFrom: '', customTo: '' },
		onFilterChange,
		onClearAll,
	}: {
		value?: string;
		placeholder?: string;
		ariaLabel?: string;
		counts?: { all: number; active: number; paid: number };
		paidLabel?: string;
		activeFilters?: { status: 'all' | 'active' | 'paid'; date: string; customFrom?: string; customTo?: string };
		onFilterChange?: (filters: { status: 'all' | 'active' | 'paid'; date: string; customFrom?: string; customTo?: string }) => void;
		onClearAll?: () => void;
	} = $props();

	// ─── State ────────────────────────────────────────────────────────
	let openMenu: 'date' | 'status' | null = $state(null);
	let menuVisible = $state(false);

	let dateChipEl = $state<HTMLButtonElement | null>(null);
	let statusChipEl = $state<HTMLButtonElement | null>(null);
	let dateMenuEl = $state<HTMLDivElement | null>(null);
	let statusMenuEl = $state<HTMLDivElement | null>(null);

	// ─── Derived ──────────────────────────────────────────────────────
	const isStatusActiveFilter = $derived(activeFilters.status !== 'active');
	const isDateActiveFilter = $derived(!!activeFilters.date);
	const isSearchActiveFilter = $derived(!!value.trim());

	const activeFilterCount = $derived(
		(isStatusActiveFilter ? 1 : 0) + (isDateActiveFilter ? 1 : 0) + (isSearchActiveFilter ? 1 : 0)
	);
	const hasActiveFilters = $derived(activeFilterCount > 0);

	const DATE_PRESET_LABELS: Record<string, string> = {
		any: 'Any Date',
		today: 'Today',
		'this-week': 'This Week',
		'this-month': 'This Month',
		'this-year': 'This Year',
		'last-3-months': 'Last 3 Months',
	};

	const dateLabel = $derived.by(() => {
		if (!activeFilters.date) return 'Date';
		if (activeFilters.date === 'custom') {
			if (activeFilters.customFrom && activeFilters.customTo) {
				return `Date: ${activeFilters.customFrom} → ${activeFilters.customTo}`;
			} else if (activeFilters.customFrom) {
				return `Date: From ${activeFilters.customFrom}`;
			} else if (activeFilters.customTo) {
				return `Date: Up to ${activeFilters.customTo}`;
			}
			return 'Date: Custom Range';
		}
		return `Date: ${DATE_PRESET_LABELS[activeFilters.date] ?? activeFilters.date}`;
	});

	const statusLabel = $derived.by(() => {
		if (activeFilters.status === 'all') return 'Status: All';
		if (activeFilters.status === 'paid') return `Status: ${paidLabel}`;
		return 'Status: Active';
	});

	// ─── Popover positioning ──────────────────────────────────────────
	function positionPopover(chipEl: HTMLElement | null, menuEl: HTMLElement | null) {
		if (!chipEl || !menuEl) return;

		const chipRect = chipEl.getBoundingClientRect();
		const menuRect = menuEl.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let left = chipRect.left;
		let top = chipRect.bottom + 4;

		const maxLeft = viewportWidth - menuRect.width - 8;
		if (left > maxLeft) left = Math.max(8, maxLeft);
		if (left < 8) left = 8;

		if (top + menuRect.height > viewportHeight - 8) {
			const flippedTop = chipRect.top - menuRect.height - 4;
			if (flippedTop >= 8) {
				top = flippedTop;
			} else {
				top = Math.max(8, viewportHeight - menuRect.height - 8);
			}
		}

		menuEl.style.left = `${left}px`;
		menuEl.style.top = `${top}px`;
	}

	function currentMenuEl(): HTMLDivElement | null {
		if (openMenu === 'date') return dateMenuEl;
		if (openMenu === 'status') return statusMenuEl;
		return null;
	}

	function updatePositions() {
		const menuEl = currentMenuEl();
		if (!menuEl) return;
		if (openMenu === 'date') positionPopover(dateChipEl, menuEl);
		else if (openMenu === 'status') positionPopover(statusChipEl, menuEl);
		menuVisible = true;
	}

	// ─── Interaction ──────────────────────────────────────────────────
	function toggleMenu(menu: 'date' | 'status') {
		openMenu = openMenu === menu ? null : menu;
		if (openMenu) {
			menuVisible = false;
			tick().then(updatePositions);
		}
	}

	function closeMenu() {
		const wasOpen = openMenu;
		openMenu = null;
		menuVisible = false;
		if (wasOpen === 'date') dateChipEl?.focus();
		else if (wasOpen === 'status') statusChipEl?.focus();
	}

	function handleDateSelect(preset: string) {
		if (preset === 'custom') {
			onFilterChange?.({
				status: activeFilters.status,
				date: 'custom',
				customFrom: activeFilters.customFrom,
				customTo: activeFilters.customTo,
			});
			return;
		}
		const date = preset === 'any' ? '' : preset;
		onFilterChange?.({
			status: activeFilters.status,
			date,
			customFrom: '',
			customTo: '',
		});
		closeMenu();
	}

	function handleCustomDateApply(from: string, to: string) {
		onFilterChange?.({
			status: activeFilters.status,
			date: 'custom',
			customFrom: from,
			customTo: to,
		});
		closeMenu();
	}

	function handleStatusSelect(status: 'all' | 'active' | 'paid') {
		onFilterChange?.({
			status,
			date: activeFilters.date,
			customFrom: activeFilters.customFrom,
			customTo: activeFilters.customTo,
		});
		closeMenu();
	}

	function handleClearAll() {
		value = '';
		onClearAll?.();
		closeMenu();
	}

	// ─── Outside click / Escape / reposition ──────────────────────────
	function handleClickOutside(e: MouseEvent) {
		if (!openMenu) return;
		const target = e.target as Node;
		const chipEls = [dateChipEl, statusChipEl].filter(Boolean);
		const menuEls = [dateMenuEl, statusMenuEl].filter(Boolean);
		const clickedChip = chipEls.some(el => el?.contains(target));
		const clickedMenu = menuEls.some(el => el?.contains(target));
		if (!clickedChip && !clickedMenu) {
			closeMenu();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeMenu();
		}
	}

	onMount(() => {
		if (!browser) return;
		document.addEventListener('click', handleClickOutside, true);
		document.addEventListener('keydown', handleKeydown, true);
		window.addEventListener('resize', updatePositions);
		window.addEventListener('scroll', updatePositions, true);
		return () => {
			document.removeEventListener('click', handleClickOutside, true);
			document.removeEventListener('keydown', handleKeydown, true);
			window.removeEventListener('resize', updatePositions);
			window.removeEventListener('scroll', updatePositions, true);
		};
	});
</script>

<div class="filter-dock" role="group" aria-label="Search and filter lendings">
	<!-- Search region -->
	<div class="dock-search">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="11" cy="11" r="8"/>
			<line x1="21" y1="21" x2="16.65" y2="16.65"/>
		</svg>
		<input
			type="search"
			{placeholder}
			aria-label={ariaLabel}
			bind:value
		/>
	</div>

	<!-- ═══ Date segment ═══ -->
	<span class="dock-divider" aria-hidden="true"></span>
	<button
		type="button"
		class="dock-chip"
		class:active={isDateActiveFilter}
		class:open={openMenu === 'date'}
		onclick={() => toggleMenu('date')}
		bind:this={dateChipEl}
		aria-haspopup="true"
		aria-expanded={openMenu === 'date'}
		aria-label={activeFilters.date ? `${dateLabel}, click to change` : `${dateLabel}, click to filter`}
	>
		<span class="chip-label">{dateLabel}</span>
		<svg class="chip-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
	</button>

	<!-- ═══ Status segment ═══ -->
	<span class="dock-divider" aria-hidden="true"></span>
	<button
		type="button"
		class="dock-chip"
		class:active={isStatusActiveFilter}
		class:open={openMenu === 'status'}
		onclick={() => toggleMenu('status')}
		bind:this={statusChipEl}
		aria-haspopup="true"
		aria-expanded={openMenu === 'status'}
		aria-label={isStatusActiveFilter ? `${statusLabel}, click to change` : `${statusLabel}, click to filter`}
	>
		<span class="chip-label">{statusLabel}</span>
		<svg class="chip-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
	</button>

	<!-- ═══ Clear All (clears search + date + status) ═══ -->
	{#if hasActiveFilters}
		<span class="dock-divider" aria-hidden="true"></span>
		<button type="button" class="dock-chip clear" onclick={handleClearAll} aria-label={`Clear all ${activeFilterCount} filters`}>
			<span class="chip-label">Clear All</span>
			<span class="chip-badge">{activeFilterCount}</span>
		</button>
	{/if}

	<!-- ═══ Popovers ═══ -->
	{#if openMenu === 'date'}
		<div class="filter-popover" class:visible={menuVisible} bind:this={dateMenuEl} role="menu" aria-label="Date filter">
			<DateFilterMenu
				activeFilter={activeFilters.date || 'any'}
				customFrom={activeFilters.customFrom ?? ''}
				customTo={activeFilters.customTo ?? ''}
				onSelect={handleDateSelect}
				onCustomApply={handleCustomDateApply}
				closePopover={closeMenu}
			/>
		</div>
	{/if}

	{#if openMenu === 'status'}
		<div class="filter-popover" class:visible={menuVisible} bind:this={statusMenuEl} role="menu" aria-label="Status filter">
			<LendingStatusFilterMenu
				activeFilter={activeFilters.status}
				{counts}
				{paidLabel}
				onSelect={handleStatusSelect}
				closePopover={closeMenu}
			/>
		</div>
	{/if}
</div>

<style>
	.filter-dock {
		display: flex;
		align-items: stretch;
		height: 44px;
		flex: 1 1 360px;
		min-width: 0;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	.dock-search {
		flex: 1;
		min-width: 90px;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 0 var(--space-lg);
		color: var(--color-text-muted);
	}

	.dock-search svg {
		flex-shrink: 0;
	}

	.dock-search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--color-text);
	}

	.dock-search input::placeholder {
		color: var(--color-text-muted);
	}

	.dock-search input::-webkit-search-cancel-button {
		-webkit-appearance: none;
	}

	.dock-divider {
		width: 1px;
		align-self: stretch;
		margin: 10px 0;
		background: var(--color-hairline);
		flex-shrink: 0;
	}

	.dock-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 0 var(--space-lg);
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: background var(--transition-fast) var(--ease), color var(--transition-fast) var(--ease);
	}

	.dock-chip:hover {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.dock-chip:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 2px var(--color-teal);
	}

	.dock-chip.active,
	.dock-chip.open {
		background: var(--color-teal-bg);
		color: var(--color-teal);
		font-weight: 600;
	}

	.chip-label {
		line-height: 1;
	}

	.chip-chevron {
		flex-shrink: 0;
		transition: transform var(--transition-fast) var(--ease);
	}

	.dock-chip.open .chip-chevron {
		transform: rotate(180deg);
	}

	.dock-chip.clear {
		color: var(--color-coral);
	}

	.dock-chip.clear:hover {
		background: var(--color-coral-bg);
		color: var(--color-coral);
	}

	.chip-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 6px;
		border-radius: var(--radius-pill);
		background: var(--color-coral);
		color: var(--color-surface);
		font-size: var(--font-size-xs);
		font-weight: 700;
		line-height: 1;
	}

	.filter-popover {
		position: fixed;
		z-index: 100;
		visibility: hidden;
		pointer-events: auto;
	}

	.filter-popover.visible {
		visibility: visible;
	}

	@media (prefers-reduced-motion: reduce) {
		.dock-chip,
		.chip-chevron {
			transition: none;
		}
	}
</style>
