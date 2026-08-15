<script lang="ts">
  import { formatCurrency } from '$lib/client/utils/format';

  let {
    moneyGone = { totalExpenses: 0, wreckedToday: 0 },
    moneyAway = { totalLent: 0, totalRecovered: 0, outstanding: 0 },
    moneyCommitted = { monthlyCommittedTotal: 0, debtOwed: 0, totalCommitted: 0 },
    truePosition = { net: 0, cash: 0, lentActive: 0, borrowedActive: 0 },
  }: {
    moneyGone?: { totalExpenses: number; wreckedToday: number };
    moneyAway?: { totalLent: number; totalRecovered: number; outstanding: number };
    moneyCommitted?: { monthlyCommittedTotal: number; debtOwed: number; totalCommitted: number };
    truePosition?: { net: number; cash: number; lentActive: number; borrowedActive: number };
  } = $props();
</script>

<div class="command-kpi-strip">
  <!-- 🔥 CARD 1: MONEY GONE -->
  <a href="/transactions" class="modality-card coral">
    <div class="card-top">
      <div class="modality-badge coral">
        <span class="icon">🔥</span>
        <span class="label">MONEY GONE</span>
      </div>
      <span class="arrow-link">→</span>
    </div>
    <div class="card-val coral">{formatCurrency(moneyGone.totalExpenses)}</div>
    <div class="card-sub">Wrecked this month ({formatCurrency(moneyGone.wreckedToday)} today)</div>
  </a>

  <!-- 🌊 CARD 2: MONEY AWAY -->
  <a href="/lending" class="modality-card sky">
    <div class="card-top">
      <div class="modality-badge sky">
        <span class="icon">🌊</span>
        <span class="label">MONEY AWAY</span>
      </div>
      <span class="arrow-link">→</span>
    </div>
    <div class="card-val sky">{formatCurrency(moneyAway.outstanding)}</div>
    <div class="card-sub">Currently outside your possession</div>
  </a>

  <!-- 🔒 CARD 3: MONEY COMMITTED -->
  <a href="/recurring" class="modality-card gold">
    <div class="card-top">
      <div class="modality-badge gold">
        <span class="icon">🔒</span>
        <span class="label">MONEY COMMITTED</span>
      </div>
      <span class="arrow-link">→</span>
    </div>
    <div class="card-val gold">{formatCurrency(moneyCommitted.totalCommitted)}</div>
    <div class="card-sub">Future commitments & debt</div>
  </a>

  <!-- 🎯 CARD 4: TRUE POSITION -->
  <a href="/net-worth" class="modality-card teal">
    <div class="card-top">
      <div class="modality-badge teal">
        <span class="icon">🎯</span>
        <span class="label">TRUE POSITION</span>
      </div>
      <span class="arrow-link">→</span>
    </div>
    <div class="card-val teal">{formatCurrency(truePosition.net)}</div>
    <div class="card-sub">Actual real standing</div>
  </a>
</div>

<style>
  .command-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-md, 12px);
  }

  .modality-card {
    display: flex;
    flex-direction: column;
    padding: 16px 18px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: 20px;
    text-decoration: none;
    box-shadow: var(--shadow-sm);
    transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
  }

  .modality-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .modality-card.coral:hover { border-color: var(--color-money-gone, #EF6C4A); }
  .modality-card.sky:hover { border-color: var(--color-money-away, #5DADE2); }
  .modality-card.gold:hover { border-color: var(--color-money-committed, #D97706); }
  .modality-card.teal:hover { border-color: var(--color-true-position, #1E8C86); }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .modality-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: var(--radius-pill, 999px);
  }

  .modality-badge .label {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
  }

  .modality-badge.coral { background: rgba(239, 108, 74, 0.12); color: var(--color-money-gone, #EF6C4A); }
  .modality-badge.sky { background: rgba(93, 173, 226, 0.12); color: var(--color-money-away, #5DADE2); }
  .modality-badge.gold { background: rgba(255, 210, 63, 0.15); color: var(--color-money-committed, #D97706); }
  .modality-badge.teal { background: rgba(30, 140, 134, 0.12); color: var(--color-true-position, #1E8C86); }

  .arrow-link {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 800;
    color: var(--color-text-muted);
  }

  .card-val {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 900;
    line-height: 1.1;
    margin-bottom: 4px;
  }

  .card-val.coral { color: var(--color-money-gone, #EF6C4A); }
  .card-val.sky { color: var(--color-money-away, #5DADE2); }
  .card-val.gold { color: var(--color-money-committed, #D97706); }
  .card-val.teal { color: var(--color-true-position, #1E8C86); }

  .card-sub {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  @media (max-width: 1024px) {
    .command-kpi-strip {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
