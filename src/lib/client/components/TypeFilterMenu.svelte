<script lang="ts">
	import { tick } from 'svelte';

	// ─── Props ────────────────────────────────────────────────────────
	let {
		activeFilter = '',
		onSelect,
		closePopover,
		embedded = false,
	}: {
		activeFilter?: string;
		onSelect?: (type: string) => void;
		closePopover?: () => void;
		// In-sheet (mobile accordion) variant: strip the card chrome.
		embedded?: boolean;
	} = $props();

	// ─── State ────────────────────────────────────────────────────────
	let menuEl = $state<HTMLDivElement | null>(null);
	let optionEls = $state<HTMLButtonElement[]>([]);

	// ─── Options ──────────────────────────────────────────────────────
	const TYPE_OPTIONS = [
		{ value: '', label: 'All Types' },
		{ value: 'income', label: 'Income' },
		{ value: 'expense', label: 'Expense' },
	] as const;

	// ─── Helpers ──────────────────────────────────────────────────────
	function handleSelect(type: string) {
		onSelect?.(type);
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
				menuEl?.querySelectorAll<HTMLButtonElement>('.type-option:not(:disabled)') ?? []
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

<div class="type-filter-menu" class:embedded bind:this={menuEl} onkeydown={handleKeydown} role="menu" tabindex="-1">
	{#each TYPE_OPTIONS as opt, i (opt.value)}
		<button
			type="button"
			class="type-option"
			class:active={activeFilter === opt.value}
			onclick={() => handleSelect(opt.value)}
			bind:this={optionEls[i]}
			role="menuitem"
			tabindex="0"
		>
			<span class="menu-dot" aria-hidden="true"></span>
			<span class="type-label">{opt.label}</span>
			{#if activeFilter === opt.value}
				<span class="check-mark" aria-hidden="true">✓</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.type-filter-menu {
		padding: var(--space-xs);
		display: flex;
		flex-direction: column;
		gap: 2px;
		/* Clamped width, no horizontal scroll */
		overflow-x: hidden;
		max-width: min(220px, calc(100vw - 16px));
		background: var(--color-cream);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}

	.type-option {
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

	.type-option:hover,
	.type-option:focus-visible {
		background: var(--color-surface);
		color: var(--color-text);
		outline: none;
	}

	.type-option:focus-visible {
		box-shadow: 0 0 0 3px var(--focus);
	}

	.type-option.active {
		background: var(--color-teal-bg);
		color: var(--color-teal);
		font-weight: 600;
	}

	.menu-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-border);
		flex-shrink: 0;
		transition: background var(--transition-fast) var(--ease), transform var(--transition-fast) var(--ease);
	}

	.type-option.active .menu-dot {
		background: var(--color-teal);
		transform: scale(1.2);
	}

	.type-option:hover .menu-dot {
		background: var(--color-hairline);
	}

	.type-label {
		flex: 1;
	}

	.check-mark {
		color: var(--color-teal);
		font-weight: 700;
		font-size: var(--font-size-sm);
		flex-shrink: 0;
	}

	/* Embedded (in-sheet) variant — flush, no card */
	.type-filter-menu.embedded {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: var(--space-xs) 0 0;
		max-width: none;
		width: 100%;
	}

	.type-filter-menu.embedded .type-option {
		min-height: 44px; /* WCAG 2.5.5 touch target */
	}

	@media (prefers-reduced-motion: reduce) {
		.type-option,
		.menu-dot {
			transition: none;
		}
	}
</style>