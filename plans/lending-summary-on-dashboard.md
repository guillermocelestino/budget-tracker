# Plan: Add Lending Summary Cards to Dashboard

## Context
The dashboard currently shows only income/expense/balance summary. The lending summary (Total Lent, Recovered, Outstanding) should also appear on the dashboard for a complete financial overview.

## Files to Modify

### 1. `src/routes/dashboard/+page.server.ts`

**Add lending totals query (after line 19):**
```typescript
const lendingSummary = await queryOne<{ totalLent: string; totalRecovered: string; outstanding: string }>(
    `SELECT
        COALESCE(SUM(amount), 0) as "totalLent",
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as "totalRecovered",
        COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0) as "outstanding"
     FROM lendings
     WHERE user_id = $1`,
    [userId]
);
```

**Add to return (line 31-38):**
```typescript
return {
    summary: { ... },
    recentTransactions,
    lendingSummary: {
        totalLent: parseFloat(lendingSummary?.totalLent ?? '0'),
        totalRecovered: parseFloat(lendingSummary?.totalRecovered ?? '0'),
        outstanding: parseFloat(lendingSummary?.outstanding ?? '0'),
    },
};
```

### 2. `src/routes/dashboard/+page.svelte`

**Create a reusable `LendingSummaryCards` component** (recommended) or add inline cards.

**Option A: Create shared component `src/lib/components/LendingSummaryCards.svelte`**
```svelte
<script lang="ts">
    import { formatCurrency } from '$lib/utils/format';

    let {
        totalLent = 0,
        totalRecovered = 0,
        outstanding = 0,
    }: { totalLent: number; totalRecovered: number; outstanding: number } = $props();
</script>

<div class="lending-summary-grid">
    <div class="summary-card lent">
        <div class="card-icon">📤</div>
        <div class="card-content">
            <span class="card-label">Total Lent</span>
            <span class="card-value">{formatCurrency(totalLent)}</span>
        </div>
    </div>
    <div class="summary-card recovered">
        <div class="card-icon">📥</div>
        <div class="card-content">
            <span class="card-label">Recovered</span>
            <span class="card-value">{formatCurrency(totalRecovered)}</span>
        </div>
    </div>
    <div class="summary-card outstanding">
        <div class="card-icon">💰</div>
        <div class="card-content">
            <span class="card-label">Outstanding</span>
            <span class="card-value">{formatCurrency(outstanding)}</span>
        </div>
    </div>
</div>
```

**Add to dashboard page (after existing SummaryCards):**
```svelte
{#if data.lendingSummary}
    <LendingSummaryCards
        totalLent={data.lendingSummary.totalLent}
        totalRecovered={data.lendingSummary.totalRecovered}
        outstanding={data.lendingSummary.outstanding}
    />
{/if}
```

## Verification
1. Run `npm run dev` → dashboard
2. Verify lending cards appear with Total Lent, Recovered, Outstanding
3. Values should match what's shown on the `/lending` page