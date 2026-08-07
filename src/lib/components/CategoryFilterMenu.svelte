<script lang="ts">
	import { tick } from 'svelte';
	import type { Category } from '$lib/types';

	// ─── Props ────────────────────────────────────────────────────────
	let {
		categories = [] as Category[],
		activeFilter = '',
		onSelect,
		closePopover,
		embedded = false,
	}: {
		categories?: Category[];
		activeFilter?: string;
		onSelect?: (category: string) => void;
		closePopover?: () => void;
		// In-sheet (mobile accordion) variant: no card chrome; the category
		// list drops its internal scroll so the sheet is the single scroll
		// container (no nested scroll on touch).
		embedded?: boolean;
	} = $props();

	// ─── State ────────────────────────────────────────────────────────
	let menuEl = $state<HTMLDivElement | null>(null);
	let optionEls = $state<HTMLButtonElement[]>([]);

	// ─── Derived ──────────────────────────────────────────────────────
	const hasCategories = $derived(categories.length > 0);

	// ─── Helpers ──────────────────────────────────────────────────────
	function handleSelect(category: string) {
		onSelect?.(category);
		closePopover?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closePopover?.();
			return;
		}
		// Arrow key navigation
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const options = Array.from(
				menuEl?.querySelectorAll<HTMLButtonElement>('.category-option:not(:disabled)') ?? []
			);
			const currentIndex = options.findIndex((el) => el === document.activeElement);
			if (currentIndex === -1) {
				optionEls[0]?.focus();
				return;
			}
			const nextIndex = e.key === 'ArrowDown'
				? (currentIndex + 1) % options.length
				: (currentIndex - 1 + options.length) % options.length;
			options[nextIndex]?.focus();
		}
	}

	// Focus first option on open
	$effect(() => {
		tick().then(() => {
			optionEls[0]?.focus();
		});
	});
</script>

<div class="category-filter-menu" class:embedded bind:this={menuEl} onkeydown={handleKeydown} role="menu" tabindex="-1">
	<!-- All Categories option -->
	<button
		type="button"
		class="category-option"
		class:active={!activeFilter}
		onclick={() => handleSelect('')}
		bind:this={optionEls[0]}
		role="menuitem"
		tabindex="0"
	>
		<span class="cat-icon" aria-hidden="true">📁</span>
		<span class="cat-label">All Categories</span>
		{#if !activeFilter}
			<span class="check-mark" aria-hidden="true">✓</span>
		{/if}
	</button>

	<!-- Category list - scrollable -->
	<div class="cat-list">
		{#each categories as cat, i (cat.name)}
			<button
				type="button"
				class="category-option"
				class:active={activeFilter === cat.name}
				onclick={() => handleSelect(cat.name)}
				bind:this={optionEls[i + 1]}
				role="menuitem"
				tabindex="0"
			>
				<span class="cat-icon" aria-hidden="true">{cat.icon}</span>
				<span class="cat-label">{cat.name}</span>
				{#if activeFilter === cat.name}
					<span class="check-mark" aria-hidden="true">✓</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if !hasCategories}
		<p class="empty-state">No categories available</p>
	{/if}
</div>

<style>
	.category-filter-menu {
		padding: var(--space-xs);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		/* Clamped width, no horizontal scroll */
		overflow-x: hidden;
		max-width: min(280px, calc(100vw - 16px));
		background: var(--color-cream);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}

	.category-option {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: none;
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 500;
		text-align: left;
		border-radius: var(--radius-md);
		cursor: pointer;
		transition: background var(--transition-fast) var(--ease), color var(--transition-fast) var(--ease);
		position: relative;
	}

	.category-option:hover,
	.category-option:focus-visible {
		background: var(--color-surface);
		color: var(--color-text);
		outline: none;
	}

	.category-option:focus-visible {
		box-shadow: 0 0 0 3px var(--focus);
	}

	.category-option.active {
		background: var(--color-teal-bg);
		color: var(--color-teal);
		font-weight: 600;
	}

	.cat-icon {
		font-size: var(--font-size-base);
		line-height: 1;
		flex-shrink: 0;
		width: 20px;
		text-align: center;
	}

	.cat-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.check-mark {
		color: var(--color-teal);
		font-weight: 700;
		font-size: var(--font-size-sm);
		flex-shrink: 0;
	}

	.cat-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		/* ONLY this menu scrolls vertically */
		max-height: 280px;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.empty-state {
		padding: var(--space-md);
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		font-family: var(--font-body);
	}

	/* Embedded (in-sheet) variant — flush, single scroll container */
	.category-filter-menu.embedded {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: var(--space-xs) 0 0;
		max-width: none;
		width: 100%;
	}

	.category-filter-menu.embedded .category-option {
		min-height: 44px; /* WCAG 2.5.5 touch target */
	}

	.category-filter-menu.embedded .cat-list {
		max-height: none;
		overflow-y: visible;
	}

	@media (prefers-reduced-motion: reduce) {
		.category-option {
			transition: none;
		}
	}
</style>