<script lang="ts">
	import DateFilterMenu from '$lib/client/components/DateFilterMenu.svelte';
	import CategoryFilterMenu from '$lib/client/components/CategoryFilterMenu.svelte';
	import TypeFilterMenu from '$lib/client/components/TypeFilterMenu.svelte';
	import type { Category } from '$lib/types';

	// ─── Props ────────────────────────────────────────────────────────
	let {
		categories = [] as Category[],
		activeFilters = { date: '', category: '', type: '', customFrom: '', customTo: '' },
		onFilterChange,
		onClearAll,
	}: {
		categories?: Category[];
		activeFilters?: { date: string; category: string; type: string; customFrom?: string; customTo?: string };
		onFilterChange?: (filters: { date: string; category: string; type: string; customFrom?: string; customTo?: string }) => void;
		onClearAll?: () => void;
	} = $props();

	// ─── State (single open section — opening one closes the others) ──
	// In-sheet accordion: the open section's options render inline below its
	// header row (pushing the rest down), so nothing floats and the sheet
	// scrolls naturally. No refs, no position:fixed, no viewport clamping.
	let openSection: 'date' | 'category' | 'type' | null = $state(null);

	// ─── Derived ──────────────────────────────────────────────────────
	const activeFilterCount = $derived(
		[activeFilters.date, activeFilters.category, activeFilters.type].filter(Boolean).length
	);
	const hasActiveFilters = $derived(activeFilterCount > 0);

	const DATE_PRESET_LABELS: Record<string, string> = {
		today: 'Today',
		'this-week': 'This Week',
		'this-month': 'This Month',
		'this-year': 'This Year',
		'last-3-months': 'Last 3 Months',
	};

	// Short "current value" shown on the right of each section header row.
	const dateValue = $derived.by(() => {
		if (!activeFilters.date) return 'Any Date';
		if (activeFilters.date === 'custom') {
			if (activeFilters.customFrom && activeFilters.customTo) {
				return `${activeFilters.customFrom} → ${activeFilters.customTo}`;
			} else if (activeFilters.customFrom) {
				return `From ${activeFilters.customFrom}`;
			} else if (activeFilters.customTo) {
				return `Up to ${activeFilters.customTo}`;
			}
			return 'Custom Range';
		}
		return DATE_PRESET_LABELS[activeFilters.date] ?? activeFilters.date;
	});

	const categoryValue = $derived.by(() => {
		if (!activeFilters.category) return 'Any';
		const cat = categories.find((c) => c.name === activeFilters.category);
		return cat ? `${cat.icon} ${cat.name}` : activeFilters.category;
	});

	const typeValue = $derived.by(() => {
		if (!activeFilters.type) return 'All';
		return activeFilters.type === 'income' ? 'Income' : 'Expense';
	});

	// ─── Interaction ──────────────────────────────────────────────────
	function toggle(section: 'date' | 'category' | 'type') {
		openSection = openSection === section ? null : section;
	}

	// Wired as closePopover to the shared menus — they call it after a
	// selection/apply, which collapses the open section (live apply matches
	// the desktop dock's behavior).
	function collapse() {
		openSection = null;
	}

	function handleDateSelect(preset: string) {
		if (preset === 'custom') {
			onFilterChange?.({
				date: 'custom',
				category: activeFilters.category,
				type: activeFilters.type,
				customFrom: activeFilters.customFrom,
				customTo: activeFilters.customTo,
			});
			return;
		}
		// 'any' means no date filter — normalize to '' so the header reads
		// inactive and the filter badge doesn't count it.
		const date = preset === 'any' ? '' : preset;
		onFilterChange?.({ date, category: activeFilters.category, type: activeFilters.type, customFrom: '', customTo: '' });
	}

	function handleCustomDateApply(from: string, to: string) {
		onFilterChange?.({
			date: 'custom',
			category: activeFilters.category,
			type: activeFilters.type,
			customFrom: from,
			customTo: to,
		});
	}

	function handleCategorySelect(category: string) {
		onFilterChange?.({ date: activeFilters.date, category, type: activeFilters.type });
	}

	function handleTypeSelect(type: string) {
		onFilterChange?.({ date: activeFilters.date, category: activeFilters.category, type });
	}

	function handleClearAll() {
		onClearAll?.();
		collapse();
	}
</script>

<div class="txn-filter-panel" role="group" aria-label="Transaction filters">
	<!-- ═══ Date section ═══ -->
	<section class="filter-segment">
		<button
			type="button"
			class="segment-header"
			class:open={openSection === 'date'}
			class:active={!!activeFilters.date}
			onclick={() => toggle('date')}
			aria-expanded={openSection === 'date'}
			aria-controls="date-filter-section"
			aria-label={`Date filter, current: ${dateValue}`}
		>
			<span class="segment-label">Date</span>
			<span class="segment-value">{dateValue}</span>
			<svg class="segment-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
		</button>

		{#if openSection === 'date'}
			<div class="segment-body" id="date-filter-section" role="region" aria-label="Date options">
				<DateFilterMenu
					embedded
					activeFilter={activeFilters.date || 'any'}
					customFrom={activeFilters.customFrom ?? ''}
					customTo={activeFilters.customTo ?? ''}
					onSelect={handleDateSelect}
					onCustomApply={handleCustomDateApply}
					closePopover={collapse}
				/>
			</div>
		{/if}
	</section>

	<!-- ═══ Category section ═══ -->
	<section class="filter-segment">
		<button
			type="button"
			class="segment-header"
			class:open={openSection === 'category'}
			class:active={!!activeFilters.category}
			onclick={() => toggle('category')}
			aria-expanded={openSection === 'category'}
			aria-controls="category-filter-section"
			aria-label={`Category filter, current: ${categoryValue}`}
		>
			<span class="segment-label">Category</span>
			<span class="segment-value">{categoryValue}</span>
			<svg class="segment-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
		</button>

		{#if openSection === 'category'}
			<div class="segment-body" id="category-filter-section" role="region" aria-label="Category options">
				<CategoryFilterMenu
					embedded
					{categories}
					activeFilter={activeFilters.category}
					onSelect={handleCategorySelect}
					closePopover={collapse}
				/>
			</div>
		{/if}
	</section>

	<!-- ═══ Type section ═══ -->
	<section class="filter-segment">
		<button
			type="button"
			class="segment-header"
			class:open={openSection === 'type'}
			class:active={!!activeFilters.type}
			onclick={() => toggle('type')}
			aria-expanded={openSection === 'type'}
			aria-controls="type-filter-section"
			aria-label={`Type filter, current: ${typeValue}`}
		>
			<span class="segment-label">Type</span>
			<span class="segment-value">{typeValue}</span>
			<svg class="segment-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
		</button>

		{#if openSection === 'type'}
			<div class="segment-body" id="type-filter-section" role="region" aria-label="Type options">
				<TypeFilterMenu
					embedded
					activeFilter={activeFilters.type}
					onSelect={handleTypeSelect}
					closePopover={collapse}
				/>
			</div>
		{/if}
	</section>

	<!-- ═══ Clear All — single reset, rose, pinned at the bottom ═══ -->
	{#if hasActiveFilters}
		<button type="button" class="clear-all" onclick={handleClearAll} aria-label={`Clear all ${activeFilterCount} filters`}>
			<svg class="clear-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
			<span>Clear All</span>
			<span class="clear-badge">{activeFilterCount}</span>
		</button>
	{/if}
</div>

<style>
	/* In-sheet accordion — the panel fills the FiltersSheet body (which owns
	   the horizontal padding). Sections stack in flow; the open one expands
	   its options below the header, so the sheet scrolls, never overlaps. */
	.txn-filter-panel {
		display: flex;
		flex-direction: column;
	}

	.filter-segment {
		border-top: 1px solid var(--color-hairline);
	}

	.filter-segment:first-child {
		border-top: none;
	}

	.segment-header {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		min-height: 48px;
		padding: 0 var(--space-sm);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-body);
		cursor: pointer;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
		transition: background var(--transition-fast) var(--ease);
	}

	.segment-header:hover {
		background: var(--color-teal-bg);
	}

	.segment-header:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus);
	}

	/* Open section: mint tint surfaces it as the active row */
	.segment-header.open {
		background: var(--color-teal-bg);
	}

	.segment-label {
		flex-shrink: 0;
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
	}

	.segment-header.open .segment-label {
		color: var(--color-teal);
	}

	.segment-value {
		flex: 1;
		min-width: 0;
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: right;
	}

	/* A filter is active on this row — value lights teal */
	.segment-header.active .segment-value {
		color: var(--color-teal);
	}

	.segment-chevron {
		flex-shrink: 0;
		color: var(--color-text-muted);
		transition: transform var(--transition-fast) var(--ease);
	}

	.segment-header.open .segment-chevron {
		transform: rotate(180deg);
		color: var(--color-teal);
	}

	/* Expanded options sit flush in the sheet — no card, no shadow */
	.segment-body {
		padding: var(--space-xs) var(--space-sm) var(--space-sm);
	}

	/* Clear All — single reset, rose, full-width touch target */
	.clear-all {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		width: 100%;
		min-height: 44px; /* WCAG 2.5.5 touch target */
		margin-top: var(--space-sm);
		padding: 0 var(--space-md);
		border: 1px solid var(--color-coral);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-coral);
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast) var(--ease), box-shadow var(--transition-fast) var(--ease);
		-webkit-tap-highlight-color: transparent;
	}

	.clear-all:hover {
		background: var(--color-coral-bg);
	}

	.clear-all:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus);
	}

	.clear-icon {
		flex-shrink: 0;
	}

	.clear-badge {
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

	@media (prefers-reduced-motion: reduce) {
		.segment-header,
		.segment-chevron,
		.clear-all {
			transition: none;
		}
	}
</style>
