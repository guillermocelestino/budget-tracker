<script lang="ts">
	// Earned success moment — a deterministic confetti burst rendered only while
	// `active` is true. Brand palette, CSS keyframes (shared confetti-fall).
	const CONFETTI_COLORS = ['var(--color-teal)', 'var(--color-gold)', 'var(--color-coral)', 'var(--color-sky)'];

	let { active = false }: { active?: boolean } = $props();

	const confettiPieces = $derived(
		active
			? Array.from({ length: 28 }, (_, i) => ({
					left: (i * 37 + 13) % 100,
					delay: (i % 10) * 0.06,
					duration: 0.9 + (i % 5) * 0.18,
					color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
					size: 6 + (i % 4) * 3,
					rot: (i % 360) * 2,
				}))
			: []
	);
</script>

{#if confettiPieces.length > 0}
	<div class="confetti" aria-hidden="true">
		{#each confettiPieces as piece, i (i)}
			<span
				class="confetti-piece"
				style="left: {piece.left}%; width: {piece.size}px; height: {piece.size}px; background: {piece.color}; animation-delay: {piece.delay}s; animation-duration: {piece.duration}s; transform: rotate({piece.rot}deg);"
			></span>
		{/each}
	</div>
{/if}

<style>
	.confetti {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		border-radius: inherit;
	}

	.confetti-piece {
		position: absolute;
		top: -12px;
		border-radius: 2px;
		opacity: 0;
		animation: confetti-fall 1.2s var(--ease) forwards;
	}
</style>