<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PageBackground from '$lib/components/PageBackground.svelte';
	import RecurringForm from '$lib/components/RecurringForm.svelte';
	import { showSuccess } from '$lib/stores/toast.svelte';

	let data = $derived($page.data as App.PageData);

	function onFormSuccess() {
		showSuccess('Recurring transaction added successfully');
		goto('/recurring');
	}
</script>

<svelte:head>
	<title>Add Recurring Transaction — Finance Tracker</title>
</svelte:head>

<PageHeader title="Add Recurring Transaction" flush>
	{#snippet subtitle()}
		<span class="context-subline">Create a template that generates transactions automatically</span>
	{/snippet}
</PageHeader>

<PageBackground />

<div class="form-page">
	<RecurringForm
		categories={data.categories ?? []}
		action="?/create"
		onSuccess={onFormSuccess}
	/>
</div>

<style>
	.form-page {
		max-width: 640px;
		margin: 0 auto;
		padding: var(--space-lg);
	}

	.context-subline {
		font-family: var(--font-mono);
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	@media (max-width: 480px) {
		.form-page {
			padding: var(--space-md);
		}
	}
</style>