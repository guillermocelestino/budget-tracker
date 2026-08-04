<script lang="ts">
    import '$lib/utils/chart';
  import { Line } from 'svelte-chartjs';
  import { formatCurrency } from '$lib/utils/format';

  let {
    labels = [],
    data = [],
  }: {
    labels: string[];
    data: number[];
  } = $props();

  // Determine direction for color choice
  const isPositive = $derived(data.length > 0 ? data[data.length - 1] >= data[0] : true);

  const chartData = $derived({
    labels,
    datasets: [
      {
        label: 'Amount',
        data,
        borderColor: isPositive ? '#2BA8A2' : '#EF6C4A',
        backgroundColor: isPositive ? 'rgba(43,168,162,0.08)' : 'rgba(239,108,74,0.08)',
        tension: 0.3,
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  });

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number }; dataset: { label: string } }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
      },
    },
  };
</script>

<div class="sparkline-container">
  {#if labels.length > 0}
    <Line data={chartData} options={chartOptions} />
  {:else}
    <div class="sparkline-empty">No data</div>
  {/if}
</div>

<style>
  .sparkline-container {
    position: relative;
    height: 80px;
    width: 100%;
  }

  .sparkline-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-secondary);
    font-style: italic;
    font-size: var(--font-size-sm);
  }
</style>