<script lang="ts">
  import { formatCurrency, countUp } from '$lib/client/utils/format';
  import type { NetWorthSnapshot } from '$lib/types';

  let {
    snapshot,
    variant = 'full',
  }: {
    snapshot: NetWorthSnapshot;
    variant?: 'full' | 'compact';
  } = $props();

  // ─── Tipping bar segments ───
  const maxMag = $derived.by(() => {
    const sum = snapshot.legs.reduce((s, l) => s + Math.abs(l.amount), 0);
    return sum || 1;
  });

  const leftTotalMag = $derived(snapshot.legs.filter(l => l.liability).reduce((s, l) => s + Math.abs(l.amount), 0));
  const rightTotalMag = $derived(snapshot.legs.filter(l => !l.liability).reduce((s, l) => s + Math.abs(l.amount), 0));

  // leftSidePct = how much of the total bar the left (liability) side occupies
  const leftSidePct = $derived((leftTotalMag / maxMag) * 50);  // % of bar, centered
  const rightSidePct = $derived((rightTotalMag / maxMag) * 50);

  type Segment = { key: string; label: string; amount: number; tone: string; width: number; side: 'left' | 'right' };
  const leftSegments = $derived.by<Segment[]>(() => {
    const segs: Segment[] = [];
    for (const leg of snapshot.legs) {
      if (!leg.liability) continue;
      const width = leftTotalMag > 0 ? (Math.abs(leg.amount) / leftTotalMag) * 100 : 0;
      segs.push({ key: leg.key, label: leg.label, amount: leg.amount, tone: leg.tone, width, side: 'left' });
    }
    return segs;
  });
  const rightSegments = $derived.by<Segment[]>(() => {
    const segs: Segment[] = [];
    for (const leg of snapshot.legs) {
      if (leg.liability) continue;
      const width = rightTotalMag > 0 ? (Math.abs(leg.amount) / rightTotalMag) * 100 : 0;
      segs.push({ key: leg.key, label: leg.label, amount: leg.amount, tone: leg.tone, width, side: 'right' });
    }
    return segs;
  });

  // ─── Net sign ───
  const netPositive = $derived(snapshot.net >= 0);
  const netColor = $derived(netPositive ? 'var(--color-teal)' : 'var(--color-coral)');

  // ─── Count-up animation ref ───
  let displayNet = $state(0);

  $effect(() => {
    const cancel = countUp(snapshot.net, 800, (val) => {
      displayNet = val;
    });
    return cancel;
  });

  // Big mover for narrative delta
  const moverLine = $derived.by(() => {
    if (!snapshot.biggestMover) return '';
    const m = snapshot.biggestMover;
    const sign = m.amount >= 0 ? 'up' : 'down';
    const tone = m.amount >= 0 ? 'var(--color-teal)' : 'var(--color-coral)';
    return `mostly from <strong style="color:${tone}">${m.label}</strong> (${sign} ${formatCurrency(Math.abs(m.amount))})`;
  });
</script>

{#if variant === 'compact'}
  <!-- ════════════════════════════════════════════
       COMPACT — Dashboard teaser, whole card is a
       deep-link to /net-worth
       ════════════════════════════════════════════ -->
  <a href="/net-worth" class="nw-compact">
    <div class="nwc-header">
      <span class="nwc-title">Net Worth</span>
      {#if snapshot.biggestMover}
        <span class="nwc-delta" style="color: {snapshot.biggestMover.amount >= 0 ? 'var(--color-teal)' : 'var(--color-coral)'}">
          {snapshot.biggestMover.amount >= 0 ? '+' : ''}{formatCurrency(snapshot.biggestMover.amount)}
        </span>
      {/if}
    </div>

    <div class="nwc-figure" style="color: {netColor}">
      {formatCurrency(displayNet)}
    </div>

    <!-- Slim tipping bar (center-out) -->
    <div class="nwc-tip-bar">
      <div class="tip-track">
        <div class="tip-left-wrap" style="width: {leftSidePct * 2}%;">
          {#each leftSegments as seg, i (i)}
            <div class="tip-segment tip-{seg.tone}" style="width: {seg.width}%;"></div>
          {/each}
        </div>
        <div class="tip-zero-wrap">
          <div class="tip-zero"></div>
        </div>
        <div class="tip-right-wrap" style="width: {rightSidePct * 2}%;">
          {#each rightSegments as seg, i (i)}
            <div class="tip-segment tip-{seg.tone}" style="width: {seg.width}%;"></div>
          {/each}
        </div>
      </div>
    </div>

    <div class="nwc-footer">
      <span class="nwc-legends">
        {#each [...leftSegments, ...rightSegments] as seg, i (i)}
          <span class="nwc-legend" style="--dot-color: var(--color-{seg.tone})">
            <span class="legend-dot"></span>{formatCurrency(seg.amount)}
          </span>
        {/each}
      </span>
      <span class="nwc-cta">Full picture →</span>
    </div>
  </a>

{:else}
  <!-- ════════════════════════════════════════════
       FULL — Hero + large tipping bar + composition
       breakdown used in the /net-worth route.
       ════════════════════════════════════════════ -->
  <div class="nw-full">
    <!-- Hero figure -->
    <div class="nw-hero">
      <div class="nw-figure" style="color: {netColor}">
        {formatCurrency(displayNet)}
      </div>
      <div class="nw-tagline">net worth</div>
    </div>

    <!-- Large tipping bar (center-out) -->
    <div class="nw-tip-bar">
      <div class="tip-track">
        <div class="tip-left-wrap" style="width: {leftSidePct * 2}%;">
          {#each leftSegments as seg, i (i)}
            <div class="tip-segment tip-{seg.tone}" style="width: {seg.width}%;"></div>
          {/each}
        </div>
        <div class="tip-zero-wrap">
          <div class="tip-zero"></div>
        </div>
        <div class="tip-right-wrap" style="width: {rightSidePct * 2}%;">
          {#each rightSegments as seg, i (i)}
            <div class="tip-segment tip-{seg.tone}" style="width: {seg.width}%;"></div>
          {/each}
        </div>
      </div>
      <div class="tip-labels">
        {#each leftSegments as seg, i (i)}
          <span class="tip-label" style="--tip-color: var(--color-{seg.tone})">
            <span class="tip-dot"></span>{seg.label} ({formatCurrency(seg.amount)})
          </span>
        {/each}
        {#each rightSegments as seg, i (i)}
          <span class="tip-label" style="--tip-color: var(--color-{seg.tone})">
            <span class="tip-dot"></span>{seg.label} ({formatCurrency(seg.amount)})
          </span>
        {/each}
      </div>
    </div>

    <!-- Narrative delta -->
    {#if moverLine}
      <!-- moverLine is generated internally from snapshot data (not user input) -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <p class="nw-narrative">Your net worth is {formatCurrency(snapshot.net)} — {@html moverLine}</p>
    {/if}

    <!-- Composition podium (donut shape + ranked list) -->
    {#if snapshot.legs.length > 0}
      <div class="nw-podium">
        <div class="podium-header">
          <span class="podium-emoji-box">🧩</span>
          <span class="podium-title">WHAT IT'S MADE OF</span>
        </div>
        <div class="podium-body">
          <!-- Donut -->
          <div class="podium-donut">
            <svg viewBox="0 0 100 100" class="donut-svg">
              {#each snapshot.legs as leg, i (i)}
                {@const offset = snapshot.legs.slice(0, i).reduce((s, l) => s + Math.abs(l.amount), 0)}
                {@const legPct = maxMag > 0 ? (Math.abs(leg.amount) / maxMag) * 100 : 0}
                {@const circumference = 2 * Math.PI * 38}
                {@const dashLen = (legPct / 100) * circumference}
                {@const dashOff = (offset / maxMag) * circumference * (legPct > 0 ? 1 : 0)}
                <circle
                  cx="50" cy="50" r="38"
                  fill="none"
                  stroke="var(--color-{leg.tone})"
                  stroke-width="24"
                  stroke-dasharray="{dashLen} {circumference - dashLen}"
                  stroke-dashoffset={-dashOff}
                  opacity="0.85"
                />
              {/each}
            </svg>
            <div class="donut-center" style="color: {netColor}">
              {formatCurrency(snapshot.net)}
            </div>
          </div>

          <!-- Ranked list -->
          <ul class="podium-list">
            {#each snapshot.legs as leg, i (i)}
              <li class="podium-item" style="--item-color: var(--color-{leg.tone})">
                <span class="podium-rank">
                  {#if i === 0}🥇{:else if i === 1}🥈{:else}🥉{/if}
                </span>
                <div class="podium-bar-wrap">
                  <span class="podium-label">{leg.label}</span>
                  <div class="podium-bar-track">
                    <div
                      class="podium-bar-fill"
                      style="width: {(Math.abs(leg.amount) / maxMag) * 100}%; background: var(--color-{leg.tone});"
                    ></div>
                  </div>
                </div>
                <span class="podium-amount" class:liability={leg.liability}>
                  {leg.liability ? '−' : ''}{formatCurrency(leg.amount)}
                </span>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ══════════════════════════════════════════════════════
     COMPACT variant
     ══════════════════════════════════════════════════════ */
  .nw-compact {
    display: block;
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-md) var(--space-lg);
    text-decoration: none;
    color: inherit;
    transition: all 200ms var(--bounce);
    box-shadow: var(--shadow-card);
  }

  .nw-compact:hover {
    transform: translateY(-2px);
    box-shadow: var(--glow-card);
  }

  .nwc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .nwc-title {
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .nwc-delta {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .nwc-figure {
    font-family: var(--font-display);
    font-size: var(--font-size-2xl);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    margin-bottom: var(--space-sm);
    letter-spacing: -0.02em;
  }

  .nwc-tip-bar { margin-bottom: var(--space-sm); }

  .nwc-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nwc-legends {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .nwc-legend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
  }

  .legend-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: var(--dot-color);
  }

  .nwc-cta {
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--color-teal);
    white-space: nowrap;
  }

  .nw-compact:hover .nwc-cta {
    color: var(--color-teal-dark);
  }

  /* ══════════════════════════════════════════════════════
     FULL variant
     ══════════════════════════════════════════════════════ */
  .nw-full {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .nw-hero {
    text-align: left;
    padding: var(--space-md) 0;
    border-bottom: 3px dashed var(--color-hairline);
  }

  .nw-figure {
    font-family: var(--font-display);
    font-size: var(--font-size-4xl);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    letter-spacing: -0.03em;
    margin-bottom: 2px;
  }

  .nw-tagline {
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ── Tipping bar (shared styles) ── */
  .nw-tip-bar { width: 100%; }

  .tip-track {
    position: relative;
    height: 12px;
    background: var(--color-teal-bg);
    border-radius: var(--radius-pill);
    overflow: hidden;
    display: flex;
    align-items: center;
  }

  .tip-left-wrap {
    height: 100%;
    display: flex;
    flex-direction: row-reverse;
    overflow: hidden;
  }

  .tip-right-wrap {
    height: 100%;
    display: flex;
    overflow: hidden;
  }

  .tip-zero-wrap {
    flex-shrink: 0;
    width: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tip-zero {
    width: 2px;
    height: 16px;
    background: var(--color-ink);
    opacity: 0.2;
    border-radius: 1px;
  }

  .tip-segment {
    height: 100%;
    transition: width 600ms var(--bounce);
    min-width: 0;
    flex-shrink: 0;
  }

  .tip-teal { background: var(--color-teal); }
  .tip-gold { background: var(--color-gold); }
  .tip-coral { background: var(--color-coral); }

  .tip-labels {
    display: flex;
    gap: var(--space-md);
    margin: var(--space-sm) 0;
    flex-wrap: wrap;
  }

  .tip-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .tip-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--tip-color);
  }

  /* ── Narrative ── */
  .nw-narrative {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    line-height: 1.6;
    margin: 0;
    padding: var(--space-md);
    background: var(--color-teal-bg);
    border-radius: var(--radius-lg);
  }

  .nw-narrative :global(strong) {
    font-weight: 700;
  }

  /* ── Podium ── */
  .nw-podium {
    background: var(--color-surface);
    border: 1px solid var(--color-hairline);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
  }

  .podium-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding-bottom: var(--space-md);
    border-bottom: 3px dashed var(--color-teal);
    margin-bottom: var(--space-md);
  }

  .podium-emoji-box {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-teal-bg);
    border-radius: var(--radius-sm);
    font-size: 16px;
    flex-shrink: 0;
  }

  .podium-title {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-ink);
    letter-spacing: 0.03em;
  }

  .podium-body {
    display: flex;
    gap: var(--space-xl);
    align-items: flex-start;
  }

  .podium-donut {
    position: relative;
    width: 140px;
    height: 140px;
    flex-shrink: 0;
  }

  .donut-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    filter: drop-shadow(var(--glow-card));
  }

  .donut-center {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: var(--font-size-base);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: center;
    line-height: 1.15;
    padding: 4px;
  }

  .podium-list {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .podium-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .podium-rank {
    font-size: var(--font-size-lg);
    flex-shrink: 0;
    width: 28px;
    text-align: center;
  }

  .podium-bar-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .podium-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text);
  }

  .podium-bar-track {
    height: 8px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .podium-bar-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 600ms var(--ease);
    min-width: 0;
  }

  .podium-amount {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    flex-shrink: 0;
    min-width: 90px;
    text-align: right;
  }

  .podium-amount.liability {
    color: var(--color-coral);
  }

  /* ══════════════════════════════════════════════════════
     Responsive
     ══════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    .nw-figure { font-size: var(--font-size-3xl); }
    .podium-body { flex-direction: column; align-items: center; }
    .podium-donut { width: 100px; height: 100px; }
    .donut-center { font-size: var(--font-size-sm); }
  }

  @media (max-width: 480px) {
    .nw-compact { padding: var(--space-sm) var(--space-md); }
    .nwc-figure { font-size: var(--font-size-xl); }
    .nw-figure { font-size: var(--font-size-2xl); }
    .podium-list { width: 100%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .tip-segment { transition: none; }
    .podium-bar-fill { transition: none; }
    .nw-compact { transition: none; }
  }
</style>