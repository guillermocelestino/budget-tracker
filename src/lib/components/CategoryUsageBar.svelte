<script lang="ts">
  let {
    percent = 0,
    status = 'ok',
  }: {
    percent: number;
    status?: 'ok' | 'warn' | 'over';
  } = $props();
</script>

<div class="usage-bar">
  <div class="usage-track">
    <div
      class="usage-fill"
      class:ok={status === 'ok'}
      class:warn={status === 'warn'}
      class:over={status === 'over'}
      style="width: {Math.min(percent, 100)}%"
    ></div>
  </div>
</div>

<style>
  .usage-bar {
    width: 100%;
  }

  .usage-track {
    width: 100%;
    height: 8px;
    background: var(--color-hairline);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .usage-fill {
    height: 100%;
    border-radius: var(--radius-pill);
    transition: width 600ms var(--ease), background 400ms ease;
    min-width: 0;
  }

  /* On track — teal fill */
  .usage-fill.ok {
    background: linear-gradient(90deg, var(--color-teal), var(--color-teal-light));
  }

  /* Near limit (75-100%) — amber fill + amber glow (status trio: teal/amber/coral) */
  .usage-fill.warn {
    background: linear-gradient(90deg, var(--color-amber-dark), var(--color-amber));
    box-shadow: 0 0 12px rgba(192, 122, 30, 0.35);
  }

  /* Over budget — coral fill with BoomPulse animation */
  .usage-fill.over {
    background: linear-gradient(90deg, var(--color-coral-dark), var(--color-coral));
    box-shadow: var(--glow-coral);
    animation: boom-pulse 1.2s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .usage-fill {
      transition: none;
    }
    .usage-fill.over {
      animation: none;
    }
  }
</style>
