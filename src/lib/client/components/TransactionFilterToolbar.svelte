<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import DateFilterMenu from '$lib/client/components/DateFilterMenu.svelte';
	import CategoryFilterMenu from '$lib/client/components/CategoryFilterMenu.svelte';
	import TypeFilterMenu from '$lib/client/components/TypeFilterMenu.svelte';
	import type { Category } from '$lib/types';

	// ─── Props ────────────────────────────────────────────────────────
	// Desktop-only: the page renders this inside .toolbar-desktop (hidden
	// ≤768px). Search is embedded — the page's debounced URL sync keeps working
	// through this bind:value, exactly as it did with the standalone pill.
	let {
		value = $bindable(''),
		placeholder = 'Search transactions…',
		ariaLabel = 'Search transactions',
		categories = [] as Category[],
		activeFilters = { date: '', category: '', type: '', customFrom: '', customTo: '' },
		onFilterChange,
		onClearAll,
	}: {
		value?: string;
		placeholder?: string;
		ariaLabel?: string;
		categories?: Category[];
		activeFilters?: { date: string; category: string; type: string; customFrom?: string; customTo?: string };
		onFilterChange?: (filters: { date: string; category: string; type: string; customFrom?: string; customTo?: string }) => void;
		onClearAll?: () => void;
	} = $props();

	// ─── State (single open segment — opening one closes the others) ──
	let openMenu: 'date' | 'category' | 'type' | null = $state(null);
	// Menus mount hidden, are measured + clamped, then revealed (no flash)
	let menuVisible = $state(false);
	let dateChipEl = $state<HTMLButtonElement | null>(null);
	let categoryChipEl = $state<HTMLButtonElement | null>(null);
	let typeChipEl = $state<HTMLButtonElement | null>(null);
	let dateMenuEl = $state<HTMLDivElement | null>(null);
	let categoryMenuEl = $state<HTMLDivElement | null>(null);
	let typeMenuEl = $state<HTMLDivElement | null>(null);

	// ─── Derived ──────────────────────────────────────────────────────
	const activeFilterCount = $derived(
		[activeFilters.date, activeFilters.category, activeFilters.type].filter(Boolean).length
	);
	const hasActiveFilters = $derived(activeFilterCount > 0);

	// Date label
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
			return activeFilters.customFrom && activeFilters.customTo
				? `Date: ${activeFilters.customFrom} → ${activeFilters.customTo}`
				: 'Date: Custom Range';
		}
		return `Date: ${DATE_PRESET_LABELS[activeFilters.date] ?? activeFilters.date}`;
	});

	// Category label — title-case via name (categories are stored title-case)
	const categoryLabel = $derived.by(() => {
		if (!activeFilters.category) return 'Category';
		const cat = categories.find(c => c.name === activeFilters.category);
		return cat ? `Category: ${cat.icon} ${cat.name}` : `Category: ${activeFilters.category}`;
	});

	// Type label — TITLE-CASE
	const typeLabel = $derived.by(() => {
		if (!activeFilters.type) return 'Type';
		const label = activeFilters.type === 'income' ? 'Income' : 'Expense';
		return `Type: ${label}`;
	});

	// ─── Popover positioning (viewport-clamped, fixed) ────────────────
	// Menus are position:fixed so they overlay cleanly and never push layout.
	// They mount `visibility: hidden`, are measured + clamped to the viewport,
	// then revealed — no position flash. IMPORTANT: .filter-dock uses
	// overflow:hidden to clip active-segment tints to the pill, but fixed
	// descendants escape ancestor overflow clipping (no transform/filter
	// ancestor here), so the menus still render above everything.
	function positionPopover(chipEl: HTMLElement | null, menuEl: HTMLElement | null) {
		if (!chipEl || !menuEl) return;

		const chipRect = chipEl.getBoundingClientRect();
		const menuRect = menuEl.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		// Default: below chip, left-aligned
		let left = chipRect.left;
		let top = chipRect.bottom + 4;

		// Horizontal clamp (never overflow viewport, no horizontal scrollbar)
		const maxLeft = viewportWidth - menuRect.width - 8;
		if (left > maxLeft) left = Math.max(8, maxLeft);
		if (left < 8) left = 8;

		// Vertical clamp (flip up if needed)
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
		if (openMenu === 'category') return categoryMenuEl;
		if (openMenu === 'type') return typeMenuEl;
		return null;
	}

	function updatePositions() {
		const menuEl = currentMenuEl();
		if (!menuEl) return;
		if (openMenu === 'date') positionPopover(dateChipEl, menuEl);
		else if (openMenu === 'category') positionPopover(categoryChipEl, menuEl);
		else if (openMenu === 'type') positionPopover(typeChipEl, menuEl);
		// Reveal only after it's measured + clamped (no position flash)
		menuVisible = true;
	}

	// ─── Interaction ──────────────────────────────────────────────────
	function toggleMenu(menu: 'date' | 'category' | 'type') {
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
		// Return focus to the segment that opened it
		if (wasOpen === 'date') dateChipEl?.focus();
		else if (wasOpen === 'category') categoryChipEl?.focus();
		else if (wasOpen === 'type') typeChipEl?.focus();
	}

	function handleDateSelect(preset: string) {
		if (preset === 'custom') return; // custom handled by inputs
		// 'any' means no date filter — normalize to '' so the segment reads
		// inactive and the filter badge doesn't count it.
		const date = preset === 'any' ? '' : preset;
		onFilterChange?.({ date, category: activeFilters.category, type: activeFilters.type });
		closeMenu();
	}

	function handleCustomDateApply(from: string, to: string) {
		onFilterChange?.({
			date: 'custom',
			category: activeFilters.category,
			type: activeFilters.type,
			customFrom: from,
			customTo: to,
		});
		closeMenu();
	}

	function handleCategorySelect(category: string) {
		onFilterChange?.({ date: activeFilters.date, category, type: activeFilters.type });
		closeMenu();
	}

	function handleTypeSelect(type: string) {
		onFilterChange?.({ date: activeFilters.date, category: activeFilters.category, type });
		closeMenu();
	}

	function handleClearAll() {
		onClearAll?.();
		closeMenu();
	}

	// ─── Outside click / Escape / reposition ──────────────────────────
	function handleClickOutside(e: MouseEvent) {
		if (!openMenu) return;
		const target = e.target as Node;
		const chipEls = [dateChipEl, categoryChipEl, typeChipEl].filter(Boolean);
		const menuEls = [dateMenuEl, categoryMenuEl, typeMenuEl].filter(Boolean);
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

<!-- ═══ Unified filter dock ═══
     One instrument: embedded search + Date / Category / Type segments +
     Clear All. Segments are separated by inset hairlines; active ones light
     up mint-teal. `overflow: hidden` clips tints to the pill — the fixed
     popovers escape it (no transformed/filtered ancestor). -->
<div class="filter-dock" role="group" aria-label="Search and filter transactions">
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
		class:active={!!activeFilters.date}
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

	<!-- ═══ Category segment ═══ -->
	<span class="dock-divider" aria-hidden="true"></span>
	<button
		type="button"
		class="dock-chip"
		class:active={!!activeFilters.category}
		class:open={openMenu === 'category'}
		onclick={() => toggleMenu('category')}
		bind:this={categoryChipEl}
		aria-haspopup="true"
		aria-expanded={openMenu === 'category'}
		aria-label={activeFilters.category ? `${categoryLabel}, click to change` : `${categoryLabel}, click to filter`}
	>
		<span class="chip-label">{categoryLabel}</span>
		<svg class="chip-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
	</button>

	<!-- ═══ Type segment ═══ -->
	<span class="dock-divider" aria-hidden="true"></span>
	<button
		type="button"
		class="dock-chip"
		class:active={!!activeFilters.type}
		class:open={openMenu === 'type'}
		onclick={() => toggleMenu('type')}
		bind:this={typeChipEl}
		aria-haspopup="true"
		aria-expanded={openMenu === 'type'}
		aria-label={activeFilters.type ? `${typeLabel}, click to change` : `${typeLabel}, click to filter`}
	>
		<span class="chip-label">{typeLabel}</span>
		<svg class="chip-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
	</button>

	<!-- ═══ Clear All (single reset, rose) ═══ -->
	{#if hasActiveFilters}
		<span class="dock-divider" aria-hidden="true"></span>
		<button type="button" class="dock-chip clear" onclick={handleClearAll} aria-label={`Clear all ${activeFilterCount} filters`}>
			<span class="chip-label">Clear All</span>
			<span class="chip-badge">{activeFilterCount}</span>
		</button>
	{/if}

	<!-- ═══ Popovers (fixed, hidden until measured+clamped) ═══ -->
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

	{#if openMenu === 'category'}
		<div class="filter-popover" class:visible={menuVisible} bind:this={categoryMenuEl} role="menu" aria-label="Category filter">
			<CategoryFilterMenu
				categories={categories}
				activeFilter={activeFilters.category}
				onSelect={handleCategorySelect}
				closePopover={closeMenu}
			/>
		</div>
	{/if}

	{#if openMenu === 'type'}
		<div class="filter-popover" class:visible={menuVisible} bind:this={typeMenuEl} role="menu" aria-label="Type filter">
			<TypeFilterMenu
				activeFilter={activeFilters.type}
				onSelect={handleTypeSelect}
				closePopover={closeMenu}
			/>
		</div>
	{/if}
</div>

<style>
	/* The dock: one rounded instrument holding search + filter segments.
	   height 44px matches ViewToggle; overflow clips segment tints to the
	   pill while the fixed popovers escape it. No transform/filter here. */
	.filter-dock {
		display: flex;
		align-items: stretch;
		height: 44px;
		flex: 1 1 360px; /* wraps to its own row on tablet instead of squeezing */
		min-width: 0;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	/* Search region: flexes with the toolbar, never forces horizontal scroll */
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

	/* Inset hairline separators between segments */
	.dock-divider {
		width: 1px;
		align-self: stretch;
		margin: 10px 0;
		background: var(--color-hairline);
		flex-shrink: 0;
	}

	/* Segments — active/open light up mint-teal, like one control surfacing */
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

	/* Active filter: mint-tint + teal (NO glow) */
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

	/* Clear All (single reset) — rose */
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

	/* Popover: fixed so it never pushes layout; mounts hidden, measured +
	   clamped by the positioner, then revealed via .visible (no flash).
	   Menus do their own clamping — only Category scrolls internally. */
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
