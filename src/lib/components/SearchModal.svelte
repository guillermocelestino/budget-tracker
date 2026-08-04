<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { formatCurrency } from '$lib/utils/format';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { Transaction, Lending } from '$lib/types';

	let {
		isOpen = false,
		onClose,
	}: {
		isOpen?: boolean;
		onClose?: () => void;
	} = $props();

	let query = $state('');
	let results = $state<{
		transactions: Transaction[];
		lendings: Lending[];
		categories: { id: number; name: string; icon: string; color: string; type: string }[];
	}>({ transactions: [], lendings: [], categories: [] });
	let isSearching = $state(false);
	let selectedIndex = $state(0);
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;
	let inputRef = $state<HTMLInputElement | null>(null);

	const allResults = $derived.by(() => {
		const items: { type: string; label: string; href: string; id: string }[] = [];
		for (const t of results.transactions) {
			items.push({
				type: 'transaction',
				label: `${t.description} — ${formatCurrency(t.amount)}`,
				href: `/transactions/${t.id}/edit`,
				id: `txn-${t.id}`,
			});
		}
		for (const l of results.lendings) {
			items.push({
				type: 'lending',
				label: `${l.borrower_name} — ${formatCurrency(l.amount)}`,
				href: '/lending',
				id: `lend-${l.id}`,
			});
		}
		for (const c of results.categories) {
			items.push({
				type: 'category',
				label: `${c.icon} ${c.name}`,
				href: '/categories',
				id: `cat-${c.id}`,
			});
		}
		return items;
	});

	function doSearch(q: string) {
		if (q.length < 2) {
			results = { transactions: [], lendings: [], categories: [] };
			isSearching = false;
			return;
		}
		isSearching = true;
		fetch(`/api/search?q=${encodeURIComponent(q)}`)
			.then(r => r.json())
			.then(data => {
				results = data;
				isSearching = false;
				selectedIndex = 0;
			})
			.catch(() => {
				isSearching = false;
			});
	}

	function handleInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		query = val;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => doSearch(val), 200);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose?.();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, allResults.length - 1);
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			const item = allResults[selectedIndex];
			if (item) {
				goto(item.href);
				onClose?.();
			}
			return;
		}
	}

	onMount(() => {
		inputRef?.focus();
	});
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="search-backdrop" onclick={onClose} role="presentation"></div>
	<div
		class="search-modal"
		transition:fly={{ y: -20, duration: 200, opacity: 0 }}
		role="dialog"
		aria-label="Search"
	>
		<div class="search-header">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="11" cy="11" r="8"/>
				<line x1="21" x2="16.65" y1="21" y2="16.65"/>
			</svg>
			<input
				bind:this={inputRef}
				type="text"
				class="search-input"
				placeholder="Search transactions, categories, lendings..."
				value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
				aria-label="Search query"
			/>
			<button class="search-kbd" onclick={onClose} aria-label="Close search">
				<kbd>ESC</kbd>
			</button>
		</div>

		<div class="search-body">
			{#if isSearching}
				<div class="search-status">Searching...</div>
			{:else if query.length < 2}
				<div class="search-hint-wrap">
					<EmptyState
						icon="🔍"
						title="Type to search"
						description="Search across transactions, categories, and lendings"
					/>
				</div>
			{:else if allResults.length === 0}
				<div class="search-hint-wrap">
					<EmptyState
						icon="📭"
						title="No results"
						description="Nothing found for &ldquo;{query}&rdquo;"
					/>
				</div>
			{:else}
				<div class="search-results">
					{#if results.transactions.length > 0}
						<div class="result-group">
							<span class="result-group-label">Transactions</span>
							{#each results.transactions as txn (txn.id)}
								<button
									class="result-item"
									class:highlighted={allResults.findIndex(r => r.id === `txn-${txn.id}`) === selectedIndex}
									onclick={() => { goto(`/transactions/${txn.id}/edit`); onClose?.(); }}
									type="button"
								>
									<div class="result-dot" class:dot-income={txn.type === 'income'} class:dot-expense={txn.type === 'expense'}>
										{txn.type === 'income' ? '+' : '−'}
									</div>
									<div class="result-info">
										<span class="result-desc">{txn.description}</span>
										<span class="result-meta">{txn.category_name ?? 'Uncategorized'} · {txn.date}</span>
									</div>
									<span class="result-amount">{formatCurrency(txn.amount)}</span>
								</button>
							{/each}
						</div>
					{/if}

					{#if results.categories.length > 0}
						<div class="result-group">
							<span class="result-group-label">Categories</span>
							{#each results.categories as cat (cat.id)}
								<button
									class="result-item"
									class:highlighted={allResults.findIndex(r => r.id === `cat-${cat.id}`) === selectedIndex}
									onclick={() => { goto('/categories'); onClose?.(); }}
									type="button"
								>
									<div class="result-dot cat-dot" style="background:{cat.color}18; color:{cat.color}">
										{cat.icon}
									</div>
									<div class="result-info">
										<span class="result-desc">{cat.name}</span>
										<span class="result-meta">{cat.type}</span>
									</div>
								</button>
							{/each}
						</div>
					{/if}

					{#if results.lendings.length > 0}
						<div class="result-group">
							<span class="result-group-label">Lendings</span>
							{#each results.lendings as lend (lend.id)}
								<button
									class="result-item"
									class:highlighted={allResults.findIndex(r => r.id === `lend-${lend.id}`) === selectedIndex}
									onclick={() => { goto('/lending'); onClose?.(); }}
									type="button"
								>
									<div class="result-dot lending-dot">
										{lend.borrower_name.charAt(0)}
									</div>
									<div class="result-info">
										<span class="result-desc">{lend.borrower_name}</span>
										<span class="result-meta">{lend.status === 'paid' ? 'Paid' : 'Active'} · {lend.date_lent}</span>
									</div>
									<span class="result-amount">{formatCurrency(lend.amount)}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="search-footer">
					<span class="kbd-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
					<span class="kbd-hint"><kbd>⏎</kbd> open</span>
					<span class="kbd-hint"><kbd>ESC</kbd> close</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.search-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(20, 48, 46, 0.4);
		backdrop-filter: blur(4px);
		z-index: 999;
	}

	.search-modal {
		position: fixed;
		top: 80px;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 560px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card), 0 12px 48px rgba(20, 48, 46, 0.12);
		z-index: 1000;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-height: 80vh;
	}

	[data-theme="dark"] .search-modal {
		box-shadow: var(--shadow-card), 0 12px 48px rgba(0, 0, 0, 0.3);
	}

	.search-header {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--color-hairline);
	}

	.search-header svg {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		font-family: var(--font-body);
		font-size: var(--font-size-base);
		color: var(--color-ink);
		outline: none;
		min-height: 36px;
	}

	.search-input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.6;
	}

	.search-kbd {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		cursor: pointer;
		transition: all 150ms var(--ease);
	}

	.search-kbd:hover {
		background: var(--color-teal-bg);
		border-color: var(--color-teal);
	}

	.search-kbd kbd {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 700;
		color: var(--color-text-muted);
	}

	/* ─── Body ─── */
	.search-body {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-sm);
		min-height: 100px;
	}

	.search-status,
	.search-empty,
	.search-hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-xl);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		gap: var(--space-sm);
		text-align: center;
	}

	.search-hint svg {
		opacity: 0.3;
	}

	/* ─── Results ─── */
	.result-group {
		margin-bottom: var(--space-sm);
	}

	.result-group-label {
		display: block;
		padding: var(--space-xs) var(--space-sm);
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: var(--font-weight-bold);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.result-item {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		min-height: 48px;
		transition: background 100ms ease;
	}

	.result-item:hover,
	.result-item.highlighted {
		background: var(--color-teal-bg);
	}

	.result-dot {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 700;
		flex-shrink: 0;
	}

	.dot-income {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.dot-expense {
		background: rgba(239, 108, 74, 0.10);
		color: var(--color-coral);
	}

	.cat-dot {
		font-size: 16px;
	}

	.lending-dot {
		background: var(--color-gold);
		color: var(--color-ink);
		font-family: var(--font-display);
	}

	.result-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.result-desc {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.result-meta {
		font-size: 10px;
		color: var(--color-text-muted);
	}

	.result-amount {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
		flex-shrink: 0;
	}

	/* ─── Footer ─── */
	.search-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-lg);
		padding: var(--space-sm) var(--space-lg);
		border-top: 1px solid var(--color-hairline);
		background: var(--color-cream);
	}

	.kbd-hint {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		color: var(--color-text-muted);
	}

	.kbd-hint kbd {
		padding: 2px 6px;
		border: 1px solid var(--color-hairline);
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		background: var(--color-surface);
		color: var(--color-text-muted);
	}

	@media (max-width: 640px) {
		.search-modal {
			top: 60px;
			max-width: calc(100vw - 24px);
			max-height: 70vh;
		}
	}
</style>
