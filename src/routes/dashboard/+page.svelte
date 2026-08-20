<script lang="ts">
	import { page } from '$app/stores';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import CommandCenterKpiStrip from '$lib/client/components/CommandCenterKpiStrip.svelte';
	import RecentActivityWidget from '$lib/client/components/RecentActivityWidget.svelte';
	import UpcomingRecurringWidget from '$lib/client/components/UpcomingRecurringWidget.svelte';
	import MobileDashboard from '$lib/client/components/dashboard/MobileDashboard.svelte';
	import MobileMoneyHero from '$lib/client/components/dashboard/MobileMoneyHero.svelte';
	import MobilePocketDrain from '$lib/client/components/dashboard/MobilePocketDrain.svelte';
	import MobileWhereItWent from '$lib/client/components/dashboard/MobileWhereItWent.svelte';
	import MobileDailyDrain from '$lib/client/components/dashboard/MobileDailyDrain.svelte';
	import { formatDate, formatCurrency } from '$lib/client/utils/format';
	import type { CategoryItem } from '$lib/client/components/dashboard/MobileWhereItWent.svelte';
	import type { DailyOutflowItem } from '$lib/client/components/dashboard/MobileDailyDrain.svelte';

	let data = $derived($page.data as App.PageData);

	// ─── Data for Money Out components ───
	const totalExpenses = $derived(data.summary?.totalExpenses ?? 0);
	const totalLent = $derived(data.commandCenter?.moneyAway?.totalLent ?? data.lendingSummary?.totalLent ?? 0);
	const totalRepaid = $derived(data.borrowedSummary?.totalRepaid ?? 0);
	const wreckedToday = $derived(data.commandCenter?.moneyGone?.wreckedToday ?? 0);
	const expenseChange = $derived(data.expenseChange ?? 0);
	const categoryExpenses = $derived((data.categoryExpenses ?? []) as CategoryItem[]);
	const dailyOutflows = $derived((data.dailyOutflows ?? []) as DailyOutflowItem[]);

	// ─── Upcoming recurring items ───
	const upcomingRecurring = $derived(data.upcomingRecurring ?? []);
	const upcomingWithDays = $derived(upcomingRecurring.map(rec => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const nextRun = new Date(rec.next_run + 'T00:00:00');
		const diffDays = Math.ceil((nextRun.getTime() - today.getTime()) / 86400000);
		let label: string;
		if (diffDays === 0) label = 'Today';
		else if (diffDays === 1) label = 'Tomorrow';
		else if (diffDays > 1 && diffDays <= 7) label = `In ${diffDays} days`;
		else label = formatDate(rec.next_run);
		return { ...rec, label };
	}));

</script>

<svelte:head>
	<title>Money Out Command Center — WRECKRD</title>
</svelte:head>

<PageBackground />

<!-- ═══════════════════════════════════════════════════════════════════════════
     DESKTOP COMPOSITION (viewports > 768px)
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="desktop-dashboard page-container page-container--workspace">
	<!-- ═══ COMMAND CENTER HERO BANNER ═══ -->
	<header class="command-hero">
		<div class="hero-left">
			<div class="hero-badge teal">
				<span class="target-icon">🎯</span>
				<span class="badge-text">MONEY OUT COMMAND CENTER</span>
			</div>
			<h1 class="hero-title">WHERE IS MY MONEY RIGHT NOW — AND WHAT'S ABOUT TO HAPPEN TO IT?</h1>
			<p class="hero-equation">Available Cash + Money Away − Money Committed = True Position</p>
		</div>
		<div class="hero-center">
			<span class="hero-val-label">TRUE POSITION</span>
			<span class="hero-val-amount teal">{formatCurrency(data.netWorth?.net ?? 0)}</span>
		</div>
		<div class="hero-actions">
			<a href="/transactions" class="btn-command coral">+ Record Expense</a>
			<a href="/lending" class="btn-command sky">+ Send Money Away</a>
			<a href="/recurring" class="btn-command gold">+ Add Commitment</a>
		</div>
	</header>

	<div class="dashboard-shell">
		<!-- LAYER 1: FOUR-MODALITY KPI STRIP (Above the Fold) -->
		<section class="dashboard-section">
			<CommandCenterKpiStrip
				moneyGone={data.commandCenter?.moneyGone}
				moneyAway={data.commandCenter?.moneyAway}
				moneyCommitted={data.commandCenter?.moneyCommitted}
				truePosition={data.commandCenter?.truePosition}
			/>
		</section>

		<!-- LAYER 2: MONEY OUT HERO CARDS (Money Hero + Pocket Drain) -->
		<section class="dashboard-section">
			<div class="money-out-grid">
				<MobileMoneyHero
					monthStr={data.currentMonthStr}
					{totalExpenses}
					{totalLent}
					{totalRepaid}
					{wreckedToday}
					{expenseChange}
				/>
				<MobilePocketDrain
					{totalExpenses}
					{totalLent}
					{totalRepaid}
					monthStr={data.currentMonthStr}
					{expenseChange}
				/>
			</div>
		</section>

		<!-- LAYER 3: WHERE IT WENT & DAILY DRAIN -->
		<section class="dashboard-section">
			<div class="breakdown-grid">
				<MobileWhereItWent
					{categoryExpenses}
					monthStr={data.currentMonthStr}
				/>
				<MobileDailyDrain
					{dailyOutflows}
					monthStr={data.currentMonthStr}
				/>
			</div>
		</section>

		<!-- LAYER 4: RECENT ACTIVITY & UPCOMING RECURRING (Activity 1/2 + Upcoming 1/2) -->
		<section class="dashboard-section">
			<div class="activity-grid">
				<RecentActivityWidget transactions={data.recentTransactions ?? []} />
				<UpcomingRecurringWidget items={upcomingWithDays} />
			</div>
		</section>
	</div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     DEDICATED MOBILE COMPOSITION (viewports <= 768px)
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="mobile-dashboard">
	<MobileDashboard {data} />
</div>

<style>
	/* ─── COMMAND CENTER HERO ─── */
	.command-hero {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg, 16px);
		padding: 22px 28px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: 24px;
		box-shadow: var(--shadow-sm);
		margin-bottom: var(--space-lg, 16px);
	}

	.hero-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}

	.hero-badge.teal {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 10px;
		background: var(--color-teal-bg, rgba(30, 140, 134, 0.12));
		border-radius: var(--radius-pill, 999px);
		width: fit-content;
		margin-bottom: 2px;
	}

	.hero-badge.teal .badge-text {
		font-family: var(--font-display);
		font-size: 11px;
		font-weight: 800;
		color: var(--color-true-position, #1E8C86);
		letter-spacing: 0.12em;
	}

	.hero-title {
		font-family: var(--font-display);
		font-size: clamp(18px, 2.2vw, 24px);
		font-weight: 800;
		color: var(--color-ink);
		margin: 0;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}

	.hero-equation {
		font-family: var(--font-mono, monospace);
		font-size: 12px;
		color: var(--color-true-position, #1E8C86);
		font-weight: 600;
		margin: 6px 0 0 0;
		opacity: 0.9;
	}

	.hero-center {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		padding: 0 16px;
		border-left: 1px solid var(--color-hairline);
		border-right: 1px solid var(--color-hairline);
	}

	.hero-val-label {
		font-size: 10px;
		font-weight: 800;
		color: var(--color-text-muted);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.hero-val-amount.teal {
		font-family: var(--font-display);
		font-size: clamp(24px, 2.8vw, 32px);
		font-weight: 900;
		color: var(--color-true-position, #1E8C86);
		line-height: 1.1;
	}

	.hero-actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
	}

	.btn-command {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 14px;
		border-radius: var(--radius-pill, 999px);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		transition: transform 140ms ease, opacity 140ms ease;
	}

	.btn-command:hover { transform: translateY(-1px); }
	.btn-command.coral { background: rgba(239, 108, 74, 0.12); color: var(--color-money-gone, #EF6C4A); }
	.btn-command.sky { background: rgba(93, 173, 226, 0.12); color: var(--color-money-away, #5DADE2); }
	.btn-command.gold { background: rgba(255, 210, 63, 0.15); color: var(--color-money-committed, #D97706); }

	:global(.page-header) {
		position: relative;
		z-index: 30;
	}

	.context-subline {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-xs);
		letter-spacing: 0.02em;
		color: var(--color-text-muted);
	}

	/* ─── Desktop vs. Mobile Composition Scoping ─── */
	.desktop-dashboard {
		display: block;
	}

	.mobile-dashboard {
		display: none;
	}

	/* ─── Dashboard Shell (Desktop) ─── */
	.dashboard-shell {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
		padding-bottom: var(--space-3xl);
	}

	/* ─── Staggered Entrance Animation ─── */
	.dashboard-section {
		animation: fadeSlideUp 400ms var(--ease) both;
	}
	.dashboard-section:nth-child(1) { animation-delay: 0ms; }
	.dashboard-section:nth-child(2) { animation-delay: 80ms; }
	.dashboard-section:nth-child(3) { animation-delay: 160ms; }
	.dashboard-section:nth-child(4) { animation-delay: 240ms; }

	@keyframes fadeSlideUp {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	/* ─── Layer 2: Money Out Grid (1/2 Money Hero + 1/2 Pocket Drain) ─── */
	.money-out-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		align-items: stretch;
	}

	/* ─── Layer 3: Breakdown Grid (1/2 Where It Went + 1/2 Daily Drain) ─── */
	.breakdown-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		align-items: stretch;
	}

	/* ─── Layer 4: Activity Grid (1/2 Activity + 1/2 Upcoming) ─── */
	.activity-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
		align-items: stretch;
	}

	/* ════════════════════════════════════════
	   RESPONSIVE LAYOUT & MOBILE SCOPING
	   ════════════════════════════════════════ */

	@media (max-width: 1024px) {
		.money-out-grid {
			grid-template-columns: 1fr;
		}

		.breakdown-grid {
			grid-template-columns: 1fr;
		}

		.activity-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.desktop-dashboard {
			display: none !important;
		}

		.mobile-dashboard {
			display: block;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dashboard-section {
			animation: none;
		}
	}
</style>