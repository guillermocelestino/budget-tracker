<script lang="ts">
	import { goto } from "$app/navigation";
	import { getCurrentMonth, getMonthLabel } from "$lib/shared/utils/format";
	import MobileMoneyHero from "./MobileMoneyHero.svelte";
	import MobilePocketDrain from "./MobilePocketDrain.svelte";
	import MobileWhereItWent from "./MobileWhereItWent.svelte";
	import MobileDailyDrain from "./MobileDailyDrain.svelte";
	import MobileStillOutThere from "./MobileStillOutThere.svelte";
	import MobileMoneyMovements from "./MobileMoneyMovements.svelte";
	import MobileLogItSheet from "./MobileLogItSheet.svelte";
	import MobileMoneyPunchOverlay, {
		type PunchType,
	} from "./MobileMoneyPunchOverlay.svelte";
	import type { Category, LendingWithPayments, Transaction } from "$lib/types";
	import type { CategoryItem } from "./MobileWhereItWent.svelte";
	import type { DailyOutflowItem } from "./MobileDailyDrain.svelte";

	let {
		data,
	}: {
		data: App.PageData;
	} = $props();

	let isSheetOpen = $state(false);
	let punchData = $state<{ type: PunchType; amount: number } | null>(null);

	const activeMonthStr = $derived(data.currentMonthStr || getCurrentMonth());
	const calendarMonthStr = getCurrentMonth();
	const isThisMonth = $derived(activeMonthStr === calendarMonthStr);

	const displayMonthLabel = $derived(getMonthLabel(activeMonthStr));

	function changeMonth(delta: number) {
		const [y, m] = activeMonthStr.split("-").map(Number);
		const date = new Date(y, m - 1 + delta, 1);
		const newY = date.getFullYear();
		const newM = String(date.getMonth() + 1).padStart(2, "0");
		const targetStr = `${newY}-${newM}`;

		if (targetStr === calendarMonthStr) {
			goto("/dashboard");
		} else {
			goto(`/dashboard?month=${targetStr}`);
		}
	}

	function handleLogSuccess(info: { type: PunchType; amount: number }) {
		punchData = info;
		isSheetOpen = false;
	}

	const totalExpenses = $derived(data.summary?.totalExpenses ?? 0);
	const totalLent = $derived(
		data.commandCenter?.moneyAway?.totalLent ??
			data.lendingSummary?.totalLent ??
			0,
	);
	const totalRepaid = $derived(data.borrowedSummary?.totalRepaid ?? 0);
	const outstandingLent = $derived(
		data.commandCenter?.moneyAway?.outstanding ??
			data.lendingSummary?.outstanding ??
			0,
	);
	const wreckedToday = $derived(
		data.commandCenter?.moneyGone?.wreckedToday ?? 0,
	);
	const expenseChange = $derived(data.expenseChange ?? 0);
	const recentTransactions = $derived(
		(data.recentTransactions ?? []) as Transaction[],
	);
	const categories = $derived((data.categories ?? []) as Category[]);
	const activeBorrowed = $derived(
		(data.activeBorrowed ?? []) as LendingWithPayments[],
	);
	const activeLent = $derived((data.activeLent ?? []) as LendingWithPayments[]);
	const categoryExpenses = $derived(
		(data.categoryExpenses ?? []) as CategoryItem[],
	);
	const dailyOutflows = $derived(
		(data.dailyOutflows ?? []) as DailyOutflowItem[],
	);
</script>

<div class="mobile-money-out-dashboard">
	<!-- 1. Money Out Branding Header -->
	<header class="branding-header">
		<h1 class="branding-title">WRECKRD</h1>
		<p class="branding-subtitle">Track. Wreck. Repeat.</p>
	</header>

	<!-- 2. Month Selector -->
	<div class="month-selector-card">
		<div class="month-nav-row">
			<button
				type="button"
				class="month-nav-btn"
				onclick={() => changeMonth(-1)}
				aria-label="Previous month"
			>
				‹
			</button>
			<span class="month-current-label">{displayMonthLabel}</span>
			<button
				type="button"
				class="month-nav-btn"
				onclick={() => changeMonth(1)}
				aria-label="Next month"
			>
				›
			</button>
		</div>
		{#if isThisMonth}
			<span class="this-month-pill">THIS MONTH</span>
		{/if}
	</div>

	<!-- 3. Left Your Pocket Hero Card -->
	<MobileMoneyHero
		monthStr={activeMonthStr}
		{totalExpenses}
		{totalLent}
		{totalRepaid}
		{wreckedToday}
		{expenseChange}
	/>

	<!-- 4. Pocket Drain Section (Diagnostic Widget) -->
	<MobilePocketDrain
		{totalExpenses}
		{totalLent}
		{totalRepaid}
		monthStr={activeMonthStr}
		{expenseChange}
	/>

	<!-- 6. Where It Went Breakdown -->
	<MobileWhereItWent {categoryExpenses} monthStr={activeMonthStr} />

	<!-- 7. Daily Drain Chart -->
	<MobileDailyDrain {dailyOutflows} monthStr={activeMonthStr} />

	<!-- 8. Still Out There Card (Point-in-Time Outstanding Lent Money & Active Loans) -->
	<MobileStillOutThere outstanding={outstandingLent} loans={activeLent} />

	<!-- 9. Money Movements Feed -->
	<MobileMoneyMovements transactions={recentTransactions} />

	<!-- 7. Floating ＋ Log it CTA Button -->
	<div class="floating-cta-container">
		<button
			type="button"
			class="log-it-floating-btn"
			onclick={() => (isSheetOpen = true)}
			aria-label="Log something"
		>
			<span class="plus-sign">＋</span>
			<span class="btn-text">Wreckrd It</span>
		</button>
	</div>

	<!-- Bottom Sheet Log Flow Modal -->
	<MobileLogItSheet
		isOpen={isSheetOpen}
		{categories}
		{activeBorrowed}
		onclose={() => (isSheetOpen = false)}
		onsuccess={handleLogSuccess}
	/>

	<!-- Post-Success Money Punch Animation Overlay -->
	{#if punchData}
		<MobileMoneyPunchOverlay
			type={punchData.type}
			amount={punchData.amount}
			onComplete={() => (punchData = null)}
		/>
	{/if}
</div>

<style>
	.mobile-money-out-dashboard {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-bottom: calc(84px + var(--safe-bottom, 0px));
	}

	/* ─── Branding Header ─── */
	.branding-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 4px 4px 0 4px;
	}

	.branding-title {
		font-family: var(--font-display);
		font-size: 22px;
		font-weight: 900;
		letter-spacing: -0.02em;
		color: var(--color-ink);
		margin: 0;
		line-height: 1.1;
	}

	.branding-subtitle {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* ─── Month Selector ─── */
	.month-selector-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-2xl, 20px);
		padding: 10px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		box-shadow: var(--shadow-sm);
	}

	.month-nav-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}

	.month-nav-btn {
		background: var(--color-surface-inset, rgba(0, 0, 0, 0.05));
		border: none;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		font-size: 18px;
		font-weight: 700;
		color: var(--color-ink);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 120ms ease;
	}

	.month-nav-btn:active {
		transform: scale(0.9);
	}

	.month-current-label {
		font-family: var(--font-display);
		font-size: 15px;
		font-weight: 800;
		color: var(--color-ink);
	}

	.this-month-pill {
		font-family: var(--font-display);
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: var(--color-teal);
		background: rgba(43, 168, 162, 0.12);
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		text-transform: uppercase;
	}

	/* ─── Floating ＋ Log it CTA Button ─── */
	.floating-cta-container {
		position: fixed;
		bottom: calc(16px + var(--safe-bottom, 0px));
		right: 16px;
		z-index: 900;
	}

	.log-it-floating-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 14px 22px;
		border-radius: var(--radius-pill, 999px);
		border: none;
		background: linear-gradient(
			135deg,
			var(--color-gold, #ffd23f) 0%,
			var(--color-gold-dark, #d97706) 100%
		);
		color: var(--color-on-gold, #14302e);
		box-shadow: var(--glow-gold, 0 6px 20px rgba(255, 210, 63, 0.5));
		cursor: pointer;
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 800;
		transition:
			transform 140ms ease,
			box-shadow 140ms ease;
	}

	.log-it-floating-btn:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 8px 24px rgba(255, 210, 63, 0.65);
	}

	.log-it-floating-btn:active {
		transform: scale(0.95);
	}

	.plus-sign {
		font-size: 18px;
		line-height: 1;
	}

	.btn-text {
		letter-spacing: -0.01em;
	}
</style>
