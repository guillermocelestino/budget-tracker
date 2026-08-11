<script lang="ts">
	import { tick } from 'svelte';

	// ─── Props ────────────────────────────────────────────────────────
	let {
		activeFilter = '',
		customFrom = $bindable(''),
		customTo = $bindable(''),
		onSelect,
		onCustomApply,
		closePopover,
		embedded = false,
	}: {
		activeFilter?: string;
		customFrom?: string;
		customTo?: string;
		onSelect?: (preset: string) => void;
		onCustomApply?: (from: string, to: string) => void;
		closePopover?: () => void;
		// In-sheet (mobile accordion) variant: strip the card chrome so the
		// options sit flush on the sheet surface — no popover chrome, no clamp.
		embedded?: boolean;
	} = $props();

	// ─── State ────────────────────────────────────────────────────────
	let menuEl = $state<HTMLDivElement | null>(null);
	let customInputs = $state<HTMLInputElement[]>([]);

	// ─── Helpers ──────────────────────────────────────────────────────
	function handlePresetClick(preset: string) {
		if (preset === 'custom') {
			onSelect?.('custom');
			return;
		}
		customFrom = '';
		customTo = '';
		onSelect?.(preset);
		closePopover?.();
	}

	const isRangeInvalid = $derived(!!customFrom && !!customTo && customFrom > customTo);
	const canApply = $derived((!!customFrom || !!customTo) && !isRangeInvalid);

	function handleCustomApply() {
		if (canApply) {
			onCustomApply?.(customFrom, customTo);
			closePopover?.();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closePopover?.();
			return;
		}
		if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
			handleCustomApply();
		}
		// Arrow key navigation for presets
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const options = Array.from(
				menuEl?.querySelectorAll<HTMLButtonElement>('.preset-btn:not(:disabled)') ?? []
			);
			const currentIndex = options.findIndex((el) => el === document.activeElement);
			if (currentIndex === -1) {
				options[0]?.focus();
				return;
			}
			const nextIndex = e.key === 'ArrowDown'
				? (currentIndex + 1) % options.length
				: (currentIndex - 1 + options.length) % options.length;
			options[nextIndex]?.focus();
		}
	}

	// Focus first input when custom range becomes visible
	$effect(() => {
		if (activeFilter === 'custom') {
			tick().then(() => {
				customInputs[0]?.focus();
			});
		}
	});
</script>

<div class="date-filter-menu" class:embedded bind:this={menuEl} onkeydown={handleKeydown} role="menu" tabindex="-1">
	{#snippet presetButton(opt: { value: string; label: string })}
		<button
			type="button"
			class="preset-btn"
			class:active={activeFilter === opt.value}
			onclick={() => handlePresetClick(opt.value)}
			role="menuitem"
			tabindex="0"
		>
			<span class="menu-dot" aria-hidden="true"></span>
			<span class="menu-label">{opt.label}</span>
			{#if activeFilter === opt.value}
				<span class="check-mark" aria-hidden="true">✓</span>
			{/if}
		</button>
	{/snippet}

	<div class="presets-section">
		{@render presetButton({ value: 'any', label: 'Any Date' })}
		{@render presetButton({ value: 'today', label: 'Today' })}
		{@render presetButton({ value: 'this-week', label: 'This Week' })}
		{@render presetButton({ value: 'this-month', label: 'This Month' })}
		{@render presetButton({ value: 'this-year', label: 'This Year' })}
		{@render presetButton({ value: 'last-3-months', label: 'Last 3 Months' })}
	</div>

	<div class="divider"></div>

	<!-- Custom range -->
	{@render presetButton({ value: 'custom', label: 'Custom Range' })}

	{#if activeFilter === 'custom'}
		<div class="custom-section expanded">
			<div class="custom-inputs">
				<div class="custom-input-group">
					<label for="custom-from">From</label>
					<input
						id="custom-from"
						type="date"
						bind:value={customFrom}
						bind:this={customInputs[0]}
						class="custom-input"
						class:invalid={isRangeInvalid}
						aria-label="Custom range from date"
					/>
				</div>
				<div class="custom-input-group">
					<label for="custom-to">To</label>
					<input
						id="custom-to"
						type="date"
						bind:value={customTo}
						bind:this={customInputs[1]}
						class="custom-input"
						class:invalid={isRangeInvalid}
						aria-label="Custom range to date"
					/>
				</div>
				{#if isRangeInvalid}
					<p class="custom-date-error" role="alert">From date cannot be after End date</p>
				{/if}
				<button
					type="button"
					class="apply-btn"
					onclick={handleCustomApply}
					disabled={!canApply}
				>
					Apply
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.date-filter-menu {
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

	.presets-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.preset-btn {
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

	.preset-btn:hover,
	.preset-btn:focus-visible {
		background: var(--color-surface);
		color: var(--color-text);
		outline: none;
	}

	.preset-btn:focus-visible {
		box-shadow: 0 0 0 3px var(--focus);
	}

	.preset-btn.active {
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

	.preset-btn.active .menu-dot {
		background: var(--color-teal);
		transform: scale(1.2);
	}

	.preset-btn:hover .menu-dot {
		background: var(--color-hairline);
	}

	.menu-label {
		flex: 1;
	}

	.check-mark {
		color: var(--color-teal);
		font-weight: 700;
		font-size: var(--font-size-sm);
		flex-shrink: 0;
	}

	.divider {
		height: 1px;
		background: var(--color-hairline);
		margin: var(--space-xs) 0;
	}

	.custom-section {
		overflow: hidden;
		transition: max-height 200ms var(--ease);
	}

	.custom-section:not(.expanded) {
		max-height: 0;
		padding: 0;
	}

	.custom-section.expanded {
		max-height: 260px;
	}

	.custom-inputs {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding-top: var(--space-xs);
	}

	.custom-input-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.custom-input-group label {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-family: var(--font-body);
		font-weight: 500;
	}

	.custom-input {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		width: 100%;
		box-sizing: border-box;
	}

	.custom-input.invalid {
		border-color: var(--color-coral);
	}

	.custom-date-error {
		font-size: var(--font-size-xs);
		color: var(--color-coral);
		font-weight: 600;
		margin: 0;
	}

	.custom-input:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: 0 0 0 3px var(--focus);
	}

	.apply-btn {
		align-self: flex-end;
		padding: var(--space-xs) var(--space-lg);
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-teal);
		color: var(--color-surface);
		font-family: var(--font-display);
		font-size: var(--font-size-xs);
		font-weight: 700;
		cursor: pointer;
		transition: background var(--transition-fast) var(--ease), transform var(--transition-fast) var(--ease);
		min-height: 32px;
	}

	.apply-btn:hover:not(:disabled) {
		background: #23908a;
	}

	.apply-btn:active:not(:disabled) {
		transform: scale(0.96);
	}

	.apply-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.apply-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus);
	}

	/* Embedded (in-sheet) variant — flush on the sheet surface, no card */
	.date-filter-menu.embedded {
		background: transparent;
		border: none;
		box-shadow: none;
		padding: var(--space-xs) 0 0;
		max-width: none;
		width: 100%;
	}

	.date-filter-menu.embedded .preset-btn {
		min-height: 44px; /* WCAG 2.5.5 touch target */
	}

	.date-filter-menu.embedded .custom-section.expanded {
		max-height: 220px; /* roomier inputs on touch */
	}

	@media (prefers-reduced-motion: reduce) {
		.preset-btn,
		.menu-dot,
		.custom-section,
		.apply-btn {
			transition: none;
		}
	}
</style>