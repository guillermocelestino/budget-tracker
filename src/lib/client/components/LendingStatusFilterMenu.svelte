<script lang="ts">
	import { tick } from 'svelte';

	// ─── Props ────────────────────────────────────────────────────────
	let {
		activeFilter = 'active',
		counts = { all: 0, active: 0, paid: 0 },
		paidLabel = 'Paid',
		onSelect,
		closePopover,
		embedded = false,
	}: {
		activeFilter?: 'all' | 'active' | 'paid';
		counts?: { all: number; active: number; paid: number };
		paidLabel?: string;
		onSelect?: (status: 'all' | 'active' | 'paid') => void;
		closePopover?: () => void;
		embedded?: boolean;
	} = $props();

	// ─── State ────────────────────────────────────────────────────────
	let menuEl = $state<HTMLDivElement | null>(null);
	let optionEls = $state<HTMLButtonElement[]>([]);

	// ─── Options ──────────────────────────────────────────────────────
	const STATUS_OPTIONS = $derived([
		{ value: 'active' as const, label: 'Active', count: counts.active },
		{ value: 'paid' as const, label: paidLabel, count: counts.paid },
		{ value: 'all' as const, label: 'All', count: counts.all },
	]);

	// ─── Helpers ──────────────────────────────────────────────────────
	function handleSelect(status: 'all' | 'active' | 'paid') {
		onSelect?.(status);
		closePopover?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closePopover?.();
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const options = Array.from(
				menuEl?.querySelectorAll<HTMLButtonElement>('.status-option:not(:disabled)') ?? []
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

	$effect(() => {
		tick().then(() => {
			optionEls[0]?.focus();
		});
	});
</script>

<div class="status-filter-menu" class:embedded bind:this={menuEl} onkeydown={handleKeydown} role="menu" tabindex="-1">
	{#each STATUS_OPTIONS as opt, i (opt.value)}
		<button
			type="button"
			class="status-option"
			class:active={activeFilter === opt.value}
			onclick={() => handleSelect(opt.value)}
			bind:this={optionEls[i]}
			role="menuitem"
			tabindex="0"
		>
			<span class="menu-dot" aria-hidden="true"></span>
			<span class="status-label">{opt.label}</span>
			<span class="status-count">({opt.count})</span>
			{#if activeFilter === opt.value}
				<span class="check-mark" aria-hidden="true">✓</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	.status-filter-menu {
		padding: var(--space-xs);
		display: flex;
		flex-direction: column;
		gap: 2px;
		overflow-x: hidden;
		max-width: min(240px, calc(100vw - 16px));
		background: var(--color-cream);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}

	.status-option {
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

	.status-option:hover,
	.status-option:focus-visible {
		background: var(--color-surface);
		color: var(--color-text);
		outline: none;
	}

	.status-option:focus-visible {
		box-shadow: 0 0 0 3px var(--focus);
	}

	.status-option.active {
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

	.status-option.active .menu-dot {
		background: var(--color-teal);
		transform: scale(1.2);
	}

	.status-option:hover .menu-dot {
		background: var(--color-hairline);
	}

	.status-label {
		flex: 1;
	}

	.status-count {
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		margin-right: 4px;
	}

	.status-option.active .status-count {
		color: var(--color-teal);
	}

	.check-mark {
		color: var(--color-teal);
		font-weight: 700;
		font-size: var(--font-size-sm);
		flex-shrink: 0;
	}

	.status-filter-menu.embedded {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: var(--space-xs) 0 0;
		max-width: none;
		width: 100%;
	}

	.status-filter-menu.embedded .status-option {
		min-height: 44px;
	}

	@media (prefers-reduced-motion: reduce) {
		.status-option,
		.menu-dot {
			transition: none;
		}
	}
</style>
