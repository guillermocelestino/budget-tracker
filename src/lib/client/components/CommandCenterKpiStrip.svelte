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
    align-items: stretch;
  }

  .modality-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 16px 18px;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: 20px;
    text-decoration: none;
    box-shadow: var(--shadow-sm);
    transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
    height: 100%;
  }

  .modality-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .modality-card.coral:hover { border-color: var(--color-money-gone, #EF6C4A); }
  .modality-card.sky:hover { border-color: var(--color-money-away, #5DADE2); }
  .modality-card.gold:hover { border-color: #B45309; }
  .modality-card.teal:hover { border-color: var(--color-true-position, #1E8C86); }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    width: 100%;
  }

  .modality-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: var(--radius-pill, 999px);
    height: 24px;
  }

  .modality-badge .label {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    line-height: 1;
  }

  .modality-badge.coral { background: rgba(239, 108, 74, 0.12); color: var(--color-money-gone, #EF6C4A); }
  .modality-badge.sky { background: rgba(93, 173, 226, 0.12); color: var(--color-money-away, #5DADE2); }
  .modality-badge.gold { background: #FEF3C7; color: #92400E; font-weight: 700; }
  .modality-badge.teal { background: rgba(30, 140, 134, 0.12); color: var(--color-true-position, #1E8C86); }

  .arrow-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 800;
    color: #475569;
    line-height: 1;
    height: 24px;
  }

  .card-val {
    font-family: var(--font-display);
    font-size: clamp(20px, 1.8vw, 24px);
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-val.coral { color: var(--color-money-gone, #EF6C4A); }
  .card-val.sky { color: var(--color-money-away, #5DADE2); }
  .card-val.gold { color: #B45309; }
  .card-val.teal { color: var(--color-true-position, #1E8C86); }

  .card-sub {
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;
    color: #475569;
  }

  /* ─── DARK MODE GUARDS ─── */
  :global([data-theme="dark"]) .modality-card.gold:hover {
    border-color: #F59E0B;
  }

  :global([data-theme="dark"]) .modality-badge.gold {
    background: rgba(251, 191, 36, 0.15);
    color: #FBBF24;
  }

  :global([data-theme="dark"]) .card-val.gold {
    color: #F59E0B;
  }

  :global([data-theme="dark"]) .arrow-link,
  :global([data-theme="dark"]) .card-sub {
    color: var(--color-text-muted);
  }

  @media (max-width: 1024px) {
    .command-kpi-strip {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
