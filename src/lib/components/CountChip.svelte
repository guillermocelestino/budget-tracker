<script lang="ts">
	let {
		count,
		suffix = ''
	}: {
		count: number;
		suffix?: string;
	} = $props();
</script>

<span class="count-chip">{count}{suffix ? ` ${suffix}` : ''}</span>

<style>
	.count-chip {
		display: inline-flex;
		align-items: center;
		background: var(--mint-tint);
		color: var(--teal-deep);
		font-family: var(--font-mono);
		font-size: var(--font-size-xs);
		font-weight: 600;
		border-radius: var(--radius-pill);
		padding: 3px 12px;
		white-space: nowrap;
		line-height: 1.4;
	}
</style>
