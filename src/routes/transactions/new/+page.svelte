<script lang="ts">
	import { page } from '$app/stores';
	import TransactionForm from '$lib/components/TransactionForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
import PageBackground from '$lib/components/PageBackground.svelte';

	let data = $derived($page.data as App.PageData);
	let form = $derived($page.form as { errors?: Record<string, string>; values?: Record<string, string> } | null);
</script>

<svelte:head>
	<title>Add Transaction — Finance Tracker</title>
</svelte:head>

<PageBackground />

<PageHeader title="Add Transaction" />

<div class="form-container">
	<TransactionForm
		categories={data.categories ?? []}
		errors={form?.errors ?? {}}
	/>
</div>

<style>
	.form-container {
		max-width: 640px;
		margin: 0 auto;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
		box-shadow: var(--shadow-sm);
	}
</style>
