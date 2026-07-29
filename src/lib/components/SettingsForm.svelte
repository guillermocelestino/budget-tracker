<script lang="ts">
	import { prefs, updatePrefs, type ThemeMode } from '$lib/stores/preferences.svelte';

	// ─── Theme options ───

	const themeOptions: { value: ThemeMode; label: string }[] = [
		{ value: 'light', label: '☀️ Light' },
		{ value: 'dark', label: '🌙 Dark' },
		{ value: 'system', label: '💻 System' },
	];

	// ─── Currency options ───

	const currencyOptions = [
		{ value: 'PHP', label: '🇵🇭 PHP (₱)' },
		{ value: 'USD', label: '🇺🇸 USD ($)' },
		{ value: 'EUR', label: '🇪🇺 EUR (€)' },
		{ value: 'GBP', label: '🇬🇧 GBP (£)' },
		{ value: 'JPY', label: '🇯🇵 JPY (¥)' },
	];

	// ─── Date format options ───

	const dateFormatOptions = [
		{ value: 'MMM DD, YYYY', label: 'Jul 15, 2026' },
		{ value: 'DD/MM/YYYY', label: '15/07/2026' },
		{ value: 'YYYY-MM-DD', label: '2026-07-15' },
		{ value: 'MM/DD/YYYY', label: '07/15/2026' },
        { value: 'EEEE, MMMM d', label: 'Sunday, July 26' },
	];
</script>

<!-- ═══ Theme ═══ -->
<div class="setting-row">
	<div class="setting-info">
		<span class="setting-label">Theme</span>
		<span class="setting-desc">Choose your visual style</span>
	</div>
	<div class="theme-pill">
		{#each themeOptions as opt}
			<button
				class="pill-option"
				class:active={prefs.theme === opt.value}
				onclick={() => updatePrefs({ theme: opt.value })}
			>
				{opt.label}
			</button>
		{/each}
	</div>
</div>

<!-- ═══ Currency ═══ -->
<div class="setting-row">
	<div class="setting-info">
		<span class="setting-label">Currency</span>
		<span class="setting-desc">Primary currency for amounts</span>
	</div>
	<div class="select-wrap">
		<select
			value={prefs.currency}
			onchange={(e) => updatePrefs({ currency: (e.target as HTMLSelectElement).value })}
		>
			{#each currencyOptions as opt}
				<option value={opt.value} selected={prefs.currency === opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
</div>

<!-- ═══ Date Format ═══ -->
<div class="setting-row">
	<div class="setting-info">
		<span class="setting-label">Date Format</span>
		<span class="setting-desc">How dates appear across the app</span>
	</div>
	<div class="select-wrap">
		<select
			value={prefs.dateFormat}
			onchange={(e) => updatePrefs({ dateFormat: (e.target as HTMLSelectElement).value })}
		>
			{#each dateFormatOptions as opt}
				<option value={opt.value} selected={prefs.dateFormat === opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	/* ─── Setting row ─── */
	.setting-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
		padding: var(--space-md) 0;
		border-bottom: 1px dashed var(--color-hairline);
		min-height: 52px;
	}

	.setting-row:last-of-type {
		border-bottom: none;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.setting-label {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
	}

	.setting-desc {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	/* ─── Theme pill segmented control ─── */
	.theme-pill {
		display: flex;
		gap: 2px;
		background: var(--color-bg);
		padding: 3px;
		border-radius: var(--radius-pill);
		flex-shrink: 0;
	}

	.pill-option {
		padding: 6px 14px;
		border: none;
		border-radius: var(--radius-pill);
		background: transparent;
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
		min-height: 36px;
		transition: all 200ms var(--bounce);
		white-space: nowrap;
	}

	.pill-option:hover {
		color: var(--color-ink);
		background: var(--color-teal-bg);
	}

	.pill-option.active {
		background: var(--color-teal);
		color: white;
		box-shadow: var(--glow-card);
	}

	/* ─── Select wrapper ─── */
	.select-wrap {
		position: relative;
		flex-shrink: 0;
		min-width: 180px;
	}

	.select-wrap select {
		width: 100%;
		padding: 8px 36px 8px 14px;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-md);
		background: var(--color-cream);
		color: var(--color-ink);
		font-family: var(--font-body);
		font-size: var(--font-size-sm);
		font-weight: 600;
		min-height: 44px;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		transition: border-color 200ms var(--ease), box-shadow 200ms var(--ease);
	}

	.select-wrap select:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
	}

	.select-wrap::after {
		content: '';
		position: absolute;
		right: 14px;
		top: 50%;
		transform: translateY(-50%);
		width: 0;
		height: 0;
		border-left: 5px solid transparent;
		border-right: 5px solid transparent;
		border-top: 5px solid var(--color-text-muted);
		pointer-events: none;
	}

	/* ─── Responsive ─── */
	@media (max-width: 640px) {
		.setting-row {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-sm);
		}

		.select-wrap {
			width: 100%;
			min-width: unset;
		}

		.theme-pill {
			width: 100%;
		}

		.pill-option {
			flex: 1;
			text-align: center;
			padding: 8px 8px;
		}
	}
</style>
