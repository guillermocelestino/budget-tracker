<script lang="ts">
	let {
		onFiles,
		onDownloadSample,
		sampleHref = '/sample-transactions.csv',
		sampleFilename = 'sample-transactions.csv',
	}: {
		onFiles?: (file: File) => void;
		onDownloadSample?: () => void;
		sampleHref?: string;
		sampleFilename?: string;
	} = $props();

	let isDragging = $state(false);
	let dropRef = $state<HTMLDivElement | null>(null);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
			onFiles?.(file);
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			onFiles?.(file);
		}
		input.value = '';
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			document.getElementById('import-file-input')?.click();
		}
	}
</script>

<div
	class="drop-zone"
	class:dragging={isDragging}
	bind:this={dropRef}
	role="button"
	tabindex="0"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onkeydown={handleKeyDown}
>
	<div class="drop-content">
		<div class="drop-icon">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
				<polyline points="14 2 14 8 20 8"/>
				<line x1="12" x2="12" y1="18" y2="12"/>
				<line x1="9" x2="15" y1="15" y2="15"/>
			</svg>
		</div>
		<p class="drop-title">Drop your CSV file here</p>
		<p class="drop-sub">or click to browse</p>
		<input
			id="import-file-input"
			type="file"
			accept=".csv,text/csv"
			class="file-input-hidden"
			onchange={handleFileInput}
		/>
		<button
			class="drop-btn"
			onclick={() => document.getElementById('import-file-input')?.click()}
			type="button"
		>
			Browse Files
		</button>
		{#if onDownloadSample}
			<a href={sampleHref} download={sampleFilename} class="drop-sample-link">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
					<polyline points="7 10 12 15 17 10"/>
					<line x1="12" y1="15" x2="12" y2="3"/>
				</svg>
				Download sample CSV
			</a>
		{/if}
	</div>
</div>

<style>
	.drop-zone {
		border: 2px dashed var(--color-teal);
		border-radius: var(--radius-xl);
		background: var(--color-teal-bg);
		padding: var(--space-2xl);
		text-align: center;
		cursor: pointer;
		transition: all 250ms var(--bounce);
		outline: none;
		min-height: 240px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.drop-zone:hover,
	.drop-zone:focus-visible {
		border-color: var(--color-teal-light);
		box-shadow: var(--glow-card);
		transform: translateY(-2px);
	}

	.drop-zone.dragging {
		border-color: var(--color-gold);
		background: rgba(255, 210, 63, 0.08);
		box-shadow: var(--glow-gold);
		transform: scale(1.02);
	}

	.drop-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		pointer-events: none;
	}

	.drop-icon {
		width: 72px;
		height: 72px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		color: var(--color-teal);
		margin-bottom: var(--space-sm);
	}

	.dragging .drop-icon {
		color: var(--color-gold);
		box-shadow: var(--glow-gold);
	}

	.drop-title {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
		margin: 0;
	}

	.drop-sub {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin: 0;
	}

	.file-input-hidden {
		display: none;
	}

	.drop-btn {
		pointer-events: auto;
		margin-top: var(--space-sm);
		padding: 10px 24px;
		background: var(--color-teal);
		color: white;
		border: none;
		border-radius: var(--radius-pill);
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		min-height: 44px;
		transition: all 200ms var(--bounce);
		box-shadow: var(--glow-card);
	}

	.drop-btn:hover {
		background: var(--color-teal-dark);
		transform: translateY(-1px);
	}

	.drop-btn:active {
		transform: scale(0.96);
	}

	.drop-sample-link {
		pointer-events: auto;
		margin-top: var(--space-md);
		padding: var(--space-xs) var(--space-md);
		background: var(--color-surface);
		color: var(--color-teal);
		border: 1px dashed var(--color-teal);
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		transition: all 150ms var(--ease);
	}

	.drop-sample-link:hover {
		background: var(--color-teal-bg);
		border-style: solid;
		text-decoration: none;
		color: var(--color-teal-dark);
	}

	@media (prefers-reduced-motion: reduce) {
		.drop-zone,
		.drop-btn,
		.drop-sample-link {
			transition: none;
		}
	}
</style>