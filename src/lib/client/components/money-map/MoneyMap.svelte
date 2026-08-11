<script lang="ts">
	import { onMount } from 'svelte';
	import MoneyNode from './MoneyNode.svelte';
	import MoneyConnection from './MoneyConnection.svelte';
	import MoneyNodeDetail, { type NodeDetailData } from './MoneyNodeDetail.svelte';
	import type { CategoryReportItem } from '$lib/server/services/transactions';

	export interface MoneyMapData {
		monthSummary: {
			income: number;
			expense: number;
			balance: number;
		};
		incomeCategories: CategoryReportItem[];
		expenseCategories: CategoryReportItem[];
		lendingItems: {
			id: number;
			borrower_name: string;
			amount: number;
			cash_paid: number;
			outstanding: number;
			status: string;
			due_date: string | null;
		}[];
		recurringItems: {
			id: number;
			description: string;
			amount: number;
			type: 'income' | 'expense';
			frequency: string;
			next_due_date: string | null;
			days_until: number | null;
			category_name: string | null;
		}[];
		monthTransactionCount: number;
		allTimeTransactionCount: number;
	}

	let { data }: { data: MoneyMapData } = $props();

	interface MapNodeInternal {
		id: string;
		type: 'net' | 'income' | 'expense' | 'lending' | 'recurring';
		title: string;
		amount: number;
		serialTag: string;
		x: number;
		y: number;
		width: number;
		height: number;
		rotation: number;
		percentage?: number;
		subtext?: string;
		color?: string;
		detailData: NodeDetailData;
	}

	// Canvas Viewport State
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let startPan = $state({ x: 0, y: 0 });

	// Node Dragging State
	let draggedNodeId = $state<string | null>(null);
	let dragOffset = $state({ x: 0, y: 0 });

	// Hover & Selection Focus State
	let hoveredNodeId = $state<string | null>(null);
	let selectedNode = $state<NodeDetailData | null>(null);

	// Active focus ID (either hovered node or selected node)
	const activeFocusId = $derived(hoveredNodeId || selectedNode?.id || null);

	// Canvas DOM Element
	let canvasContainerEl = $state<HTMLDivElement | null>(null);

	// Organic nodes state
	let nodes = $state<MapNodeInternal[]>([]);

	const hasData = $derived(
		data.incomeCategories.length > 0 ||
		data.expenseCategories.length > 0 ||
		data.lendingItems.length > 0 ||
		data.recurringItems.length > 0 ||
		data.monthSummary.income > 0 ||
		data.monthSummary.expense > 0
	);

	// Generate organic radial network layout centered in the viewport with collision avoidance & auto-fit
	function calculatePositions() {
		const newNodes: MapNodeInternal[] = [];
		const vw = canvasContainerEl?.offsetWidth || 1000;
		const vh = canvasContainerEl?.offsetHeight || 640;

		// Center of viewport canvas
		const cx = Math.max(450, vw / 2);
		const cy = Math.max(320, vh / 2);

		// 1. Central Net Money Node (Node W: 250, H: 120)
		const netNode: MapNodeInternal = {
			id: 'net-money',
			type: 'net',
			title: 'NET MONEY',
			amount: data.monthSummary.balance,
			serialTag: '#NET-01',
			x: cx - 125,
			y: cy - 60,
			width: 250,
			height: 120,
			rotation: 0,
			detailData: {
				id: 'net-money',
				type: 'net',
				title: 'NET MONEY',
				amount: data.monthSummary.balance,
				serialTag: '#NET-01',
				totalIncome: data.monthSummary.income,
				totalExpenses: data.monthSummary.expense
			}
		};
		newNodes.push(netNode);

		// 2. Income Category Nodes (Upper region / Top arc: -140deg to -40deg)
		const totalIncome = data.monthSummary.income || 1;
		const incCount = data.incomeCategories.length;
		const incStep = incCount > 1 ? 100 / (incCount - 1) : 0;
		data.incomeCategories.forEach((cat, idx) => {
			const angle = incCount === 1 ? -90 : -140 + idx * incStep;
			const rad = (angle * Math.PI) / 180;
			const distance = 250 + (idx % 2) * 35;
			const w = 185;
			const h = 92;
			const nx = cx + Math.cos(rad) * distance - w / 2;
			const ny = cy + Math.sin(rad) * distance - h / 2;
			const pct = Math.round((cat.total / totalIncome) * 100);

			newNodes.push({
				id: `inc-${cat.category_id}`,
				type: 'income',
				title: cat.category_name,
				amount: cat.total,
				serialTag: `#INC-0${idx + 1}`,
				x: nx,
				y: ny,
				width: w,
				height: h,
				rotation: idx % 2 === 0 ? -2 : 2.5,
				percentage: pct,
				color: cat.category_color,
				detailData: {
					id: `inc-${cat.category_id}`,
					type: 'income',
					title: cat.category_name,
					amount: cat.total,
					serialTag: `#INC-0${idx + 1}`,
					percentage: pct,
					color: cat.category_color
				}
			});
		});

		// 3. Expense Category Nodes (Lower-right / Right region: 15deg to 115deg)
		const totalExpense = data.monthSummary.expense || 1;
		const expCount = data.expenseCategories.length;
		const expStep = expCount > 1 ? 95 / (expCount - 1) : 0;
		data.expenseCategories.forEach((cat, idx) => {
			const angle = expCount === 1 ? 45 : 15 + idx * expStep;
			const rad = (angle * Math.PI) / 180;
			const distance = 270 + (idx % 2) * 85;
			const w = 185;
			const h = 92;
			const nx = cx + Math.cos(rad) * distance - w / 2;
			const ny = cy + Math.sin(rad) * distance - h / 2;
			const pct = Math.round((cat.total / totalExpense) * 100);

			newNodes.push({
				id: `exp-${cat.category_id}`,
				type: 'expense',
				title: cat.category_name,
				amount: cat.total,
				serialTag: `#EXP-0${idx + 1}`,
				x: nx,
				y: ny,
				width: w,
				height: h,
				rotation: idx % 2 === 0 ? 3 : -2,
				percentage: pct,
				color: cat.category_color,
				detailData: {
					id: `exp-${cat.category_id}`,
					type: 'expense',
					title: cat.category_name,
					amount: cat.total,
					serialTag: `#EXP-0${idx + 1}`,
					percentage: pct,
					color: cat.category_color
				}
			});
		});

		// 4. Lending Nodes (Left region: -175deg to -125deg with concentric staggering)
		const lndCount = data.lendingItems.length;
		const lndStep = lndCount > 1 ? 50 / (lndCount - 1) : 0;
		data.lendingItems.forEach((lend, idx) => {
			const angle = lndCount === 1 ? -165 : -175 + idx * lndStep;
			const rad = (angle * Math.PI) / 180;
			const distance = 275 + (idx % 2) * 75;
			const w = 170;
			const h = 84;
			const nx = cx + Math.cos(rad) * distance - w / 2;
			const ny = cy + Math.sin(rad) * distance - h / 2;

			newNodes.push({
				id: `lend-${lend.id}`,
				type: 'lending',
				title: `Lent: ${lend.borrower_name}`,
				amount: lend.outstanding,
				serialTag: `#LND-0${idx + 1}`,
				x: nx,
				y: ny,
				width: w,
				height: h,
				rotation: idx % 2 === 0 ? -3 : 1.5,
				subtext: lend.cash_paid > 0 ? `₱${lend.cash_paid.toLocaleString()} paid` : 'Outstanding',
				detailData: {
					id: `lend-${lend.id}`,
					type: 'lending',
					title: `Lending: ${lend.borrower_name}`,
					amount: lend.amount,
					serialTag: `#LND-0${idx + 1}`,
					cashPaid: lend.cash_paid,
					outstanding: lend.outstanding
				}
			});
		});

		// 5. Recurring Nodes (Lower-left / Bottom region: 125deg to 175deg with concentric staggering)
		const recCount = data.recurringItems.length;
		const recStep = recCount > 1 ? 50 / (recCount - 1) : 0;
		data.recurringItems.forEach((rec, idx) => {
			const angle = recCount === 1 ? 145 : 125 + idx * recStep;
			const rad = (angle * Math.PI) / 180;
			const distance = 270 + (idx % 2) * 70;
			const w = 170;
			const h = 84;
			const nx = cx + Math.cos(rad) * distance - w / 2;
			const ny = cy + Math.sin(rad) * distance - h / 2;

			const dueStr = rec.days_until !== null ? `In ${rec.days_until}d` : rec.frequency;

			newNodes.push({
				id: `rec-${rec.id}`,
				type: 'recurring',
				title: rec.description,
				amount: rec.amount,
				serialTag: `#REC-0${idx + 1}`,
				x: nx,
				y: ny,
				width: w,
				height: h,
				rotation: idx % 2 === 0 ? 2 : -2,
				subtext: dueStr,
				detailData: {
					id: `rec-${rec.id}`,
					type: 'recurring',
					title: rec.description,
					amount: rec.amount,
					serialTag: `#REC-0${idx + 1}`,
					frequency: rec.frequency,
					nextDueDate: rec.next_due_date,
					daysUntil: rec.days_until
				}
			});
		});

		// 6. Deterministic Bounding Box Collision Resolution Pass
		const GAP = 28; // Minimum gap in px between node bounding boxes
		for (let iter = 0; iter < 35; iter++) {
			let shifted = false;
			for (let i = 0; i < newNodes.length; i++) {
				for (let j = i + 1; j < newNodes.length; j++) {
					const a = newNodes[i];
					const b = newNodes[j];

					// Check bounding box overlap with GAP
					const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + GAP;
					const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + GAP;

					if (overlapX > 0 && overlapY > 0) {
						shifted = true;
						const dx = (b.x + b.width / 2) - (a.x + a.width / 2) || 1;
						const dy = (b.y + b.height / 2) - (a.y + a.height / 2) || 1;
						const len = Math.hypot(dx, dy) || 1;
						const pushDist = Math.min(overlapX, overlapY) / 2 + 2;

						const pushX = (dx / len) * pushDist;
						const pushY = (dy / len) * pushDist;

						if (a.type === 'net') {
							// Keep Net Money centered, push b away
							b.x += pushX * 2;
							b.y += pushY * 2;
						} else if (b.type === 'net') {
							a.x -= pushX * 2;
							a.y -= pushY * 2;
						} else {
							a.x -= pushX;
							a.y -= pushY;
							b.x += pushX;
							b.y += pushY;
						}
					}
				}
			}
			if (!shifted) break;
		}

		// 7. Auto-Fit Viewport Calculation (Center & Scale Entire Ecosystem to 75% Canvas Area)
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		newNodes.forEach((n) => {
			if (n.x < minX) minX = n.x;
			if (n.y < minY) minY = n.y;
			if (n.x + n.width > maxX) maxX = n.x + n.width;
			if (n.y + n.height > maxY) maxY = n.y + n.height;
		});

		const ecoW = maxX - minX || 1;
		const ecoH = maxY - minY || 1;

		const targetFillRatio = 0.75;
		const scaleX = (vw * targetFillRatio) / ecoW;
		const scaleY = (vh * targetFillRatio) / ecoH;
		const autoZoom = Math.min(1.0, Math.max(0.55, Math.min(scaleX, scaleY)));

		zoom = autoZoom;

		// Frame ecosystem bounding box center at viewport center
		const ecoCx = minX + ecoW / 2;
		const ecoCy = minY + ecoH / 2;
		panX = (vw / 2 - ecoCx) * autoZoom;
		panY = (vh / 2 - ecoCy) * autoZoom;

		nodes = newNodes;
	}

	$effect(() => {
		calculatePositions();
	});

	onMount(() => {
		calculatePositions();

		const handleResize = () => calculatePositions();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Calculated connections between Central Net Money and surrounding nodes
	const connections = $derived.by(() => {
		const centralNode = nodes.find((n) => n.id === 'net-money');
		if (!centralNode) return [];

		// Center coordinate of central banknote
		const cx = centralNode.x + centralNode.width / 2;
		const cy = centralNode.y + centralNode.height / 2;

		return nodes
			.filter((n) => n.id !== 'net-money')
			.map((n) => {
				// Center coordinate of child banknote card
				const nx = n.x + n.width / 2;
				const ny = n.y + n.height / 2;

				// Incoming flow for income, outgoing for expenses/lending/recurring
				const isIncome = n.type === 'income';
				const x1 = isIncome ? nx : cx;
				const y1 = isIncome ? ny : cy;
				const x2 = isIncome ? cx : nx;
				const y2 = isIncome ? cy : ny;

				const isHighlighted =
					activeFocusId === n.id ||
					activeFocusId === 'net-money' ||
					selectedNode?.id === n.id ||
					selectedNode?.id === 'net-money';

				const isDimmed = activeFocusId !== null && !isHighlighted;

				return {
					id: `conn-${n.id}`,
					nodeId: n.id,
					x1,
					y1,
					x2,
					y2,
					type: n.type,
					amount: n.amount,
					isHighlighted,
					isDimmed
				};
			});
	});

	// Calculate target pixel position of selected node for popover anchor
	const selectedNodeTargetPos = $derived.by(() => {
		const selected = selectedNode;
		if (!selected) return null;
		const node = nodes.find((n) => n.id === selected.id);
		if (!node) return null;
		const px = (node.x + node.width / 2) * zoom + panX;
		const py = (node.y + node.height / 2) * zoom + panY;
		return { x: px, y: py };
	});

	const containerBounds = $derived.by(() => {
		if (!canvasContainerEl) return null;
		return { width: canvasContainerEl.offsetWidth, height: canvasContainerEl.offsetHeight };
	});

	// Canvas Drag / Pan Handlers
	function handleCanvasPointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;

		// If user clicks on empty canvas space, close detail popover
		if (
			!target.closest('.banknote-position-layer') &&
			!target.closest('.canvas-controls') &&
			!target.closest('.detail-floating-panel')
		) {
			selectedNode = null;
		}

		if (target.closest('.banknote-position-layer') || target.closest('.canvas-controls') || target.closest('.detail-floating-panel')) {
			return;
		}

		isPanning = true;
		startPan = { x: e.clientX - panX, y: e.clientY - panY };
	}

	function handlePointerMove(e: PointerEvent) {
		if (isPanning) {
			panX = e.clientX - startPan.x;
			panY = e.clientY - startPan.y;
		} else if (draggedNodeId) {
			nodes = nodes.map((node) => {
				if (node.id === draggedNodeId) {
					return {
						...node,
						x: (e.clientX - dragOffset.x - panX) / zoom,
						y: (e.clientY - dragOffset.y - panY) / zoom
					};
				}
				return node;
			});
		}
	}

	function handlePointerUp() {
		isPanning = false;
		draggedNodeId = null;
	}

	// Node Dragging Start
	function handleNodeDragStart(e: PointerEvent, id: string) {
		e.stopPropagation();
		draggedNodeId = id;
		const targetNode = nodes.find((n) => n.id === id);
		if (targetNode) {
			dragOffset = {
				x: e.clientX - targetNode.x * zoom - panX,
				y: e.clientY - targetNode.y * zoom - panY
			};
		}
	}

	// Node Selection
	function handleNodeSelect(id: string) {
		const targetNode = nodes.find((n) => n.id === id);
		if (targetNode) {
			selectedNode = targetNode.detailData;
		}
	}

	// Zoom Controls
	function zoomIn() {
		zoom = Math.min(2.0, zoom + 0.15);
	}

	function zoomOut() {
		zoom = Math.max(0.5, zoom - 0.15);
	}

	function resetMap() {
		calculatePositions();
	}

	const maxAmount = $derived(
		Math.max(1, ...nodes.map((n) => n.amount))
	);
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

<div class="money-map-canvas-card flip7-card">
	<!-- Canvas Control Buttons -->
	<div class="canvas-controls">
		<button class="control-btn" onclick={zoomIn} title="Zoom In (+)" aria-label="Zoom in">+</button>
		<button class="control-btn" onclick={zoomOut} title="Zoom Out (−)" aria-label="Zoom out">−</button>
		<div class="control-divider"></div>
		<button class="control-btn text-btn" onclick={resetMap} title="Reset Map View">Reset Map</button>
	</div>

	<!-- Interactive Map Viewport -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={canvasContainerEl}
		class="canvas-viewport"
		class:panning={isPanning}
		onpointerdown={handleCanvasPointerDown}
	>
		{#if !hasData}
			<!-- Empty State inside Canvas -->
			<div class="map-empty-state">
				<div class="empty-banknote-icon">
					<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<rect width="20" height="12" x="2" y="6" rx="2"/>
						<circle cx="12" cy="12" r="3"/>
						<path d="M6 12h.01M18 12h.01"/>
					</svg>
				</div>
				<h3>Your Money Map is Ready</h3>
				<p>Add income, expenses, or recurring transactions to see your financial ecosystem map come to life.</p>
				<a href="/transactions" class="empty-cta-btn">+ Add First Transaction</a>
			</div>
		{:else}
			<!-- Canvas Transform Group (Shared Pan & Zoom for SVG and Nodes) -->
			<div
				class="canvas-transform-layer"
				style="transform: translate3d({panX}px, {panY}px, 0) scale({zoom});"
			>
				<!-- SVG Connection Layer (matches 1-to-1 pixel canvas space) -->
				<svg class="svg-connections-layer">
					{#each connections as conn (conn.id)}
						<MoneyConnection
							x1={conn.x1}
							y1={conn.y1}
							x2={conn.x2}
							y2={conn.y2}
							type={conn.type}
							amount={conn.amount}
							{maxAmount}
							isHighlighted={conn.isHighlighted}
							isDimmed={conn.isDimmed}
						/>
					{/each}
				</svg>

				<!-- Floating Banknote Nodes -->
				<div class="nodes-layer">
					{#each nodes as node (node.id)}
						<MoneyNode
							id={node.id}
							type={node.type}
							title={node.title}
							amount={node.amount}
							serialTag={node.serialTag}
							x={node.x}
							y={node.y}
							rotation={node.rotation}
							percentage={node.percentage}
							subtext={node.subtext}
							color={node.color}
							isCentral={node.type === 'net'}
							isHighlighted={hoveredNodeId === node.id || selectedNode?.id === node.id}
							isDimmed={activeFocusId !== null && activeFocusId !== node.id && activeFocusId !== 'net-money'}
							isSelected={selectedNode?.id === node.id}
							onselect={handleNodeSelect}
							ondragstart={handleNodeDragStart}
							onhover={(id) => (hoveredNodeId = id)}
						/>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Selected Node Floating Popover Panel (Desktop) / Bottom Sheet (Mobile) -->
		<MoneyNodeDetail
			node={selectedNode}
			targetPosition={selectedNodeTargetPos}
			{containerBounds}
			onclose={() => (selectedNode = null)}
		/>
	</div>
</div>

<style>
	.money-map-canvas-card {
		position: relative;
		width: 100%;
		height: 660px;
		min-height: 540px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl);
		overflow: hidden;
		user-select: none;
		box-shadow: var(--shadow-card);
	}

	@media (max-width: 768px) {
		.money-map-canvas-card {
			height: 560px;
		}
	}

	/* Controls Header Pill */
	.canvas-controls {
		position: absolute;
		top: var(--space-md);
		right: var(--space-md);
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-sm);
	}

	.control-btn {
		background: none;
		border: none;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		width: 28px;
		height: 28px;
		border-radius: 50%;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 150ms ease;
	}

	.control-btn:hover {
		background: var(--color-teal-bg);
		color: var(--color-teal);
	}

	.control-btn.text-btn {
		width: auto;
		height: 28px;
		padding: 0 10px;
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: 11px;
		font-weight: var(--font-weight-bold);
	}

	.control-divider {
		width: 1px;
		height: 16px;
		background: var(--color-hairline);
		margin: 0 2px;
	}

	/* Viewport Canvas */
	.canvas-viewport {
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		cursor: grab;
		background-image:
			radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255, 210, 63, 0.06) 0%, transparent 70%),
			radial-gradient(ellipse 80% 80% at 20% 20%, rgba(43, 168, 162, 0.04) 0%, transparent 60%);
	}

	.canvas-viewport.panning {
		cursor: grabbing;
	}

	.canvas-transform-layer {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		transform-origin: 50% 50%;
		will-change: transform;
	}

	.svg-connections-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
		z-index: 1;
	}

	.nodes-layer {
		position: absolute;
		inset: 0;
		z-index: 2;
	}

	/* Empty State UI */
	.map-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--space-xl);
		text-align: center;
	}

	.empty-banknote-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		background: var(--color-teal-bg);
		color: var(--color-teal);
		border-radius: var(--radius-2xl);
		margin-bottom: var(--space-md);
	}

	.map-empty-state h3 {
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		margin-bottom: var(--space-xs);
	}

	.map-empty-state p {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		max-width: 380px;
		margin-bottom: var(--space-lg);
	}

	.empty-cta-btn {
		display: inline-flex;
		align-items: center;
		padding: 10px 20px;
		background: var(--color-teal);
		color: #ffffff;
		border-radius: var(--radius-pill);
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-sm);
		text-decoration: none;
		box-shadow: var(--shadow-sm);
		transition: all 150ms var(--bounce);
	}

	.empty-cta-btn:hover {
		background: var(--color-teal-dark);
		transform: translateY(-2px);
	}
</style>
