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
    height: 6px;
    background: var(--color-bg);
    border-radius: 999px;
    overflow: hidden;
  }

  .usage-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 500ms cubic-bezier(0.4, 0, 0.2, 1),
                background 300ms ease;
    min-width: 0;
  }

  /* Under budget — cool teal/green gradient */
  .usage-fill.ok {
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  /* Warning zone (75–99%) — amber */
  .usage-fill.warn {
    background: linear-gradient(90deg, #f59e0b, #fbbf24);
  }

  /* Over budget (100%+) — red gradient with subtle pulse */
  .usage-fill.over {
    background: linear-gradient(90deg, #ef4444, #f87171);
    animation: budgetPulse 2s ease-in-out infinite;
  }

  @keyframes budgetPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.72; }
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
