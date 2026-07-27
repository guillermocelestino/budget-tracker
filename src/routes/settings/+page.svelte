<script lang="ts">
  import PageHeader from '$lib/components/PageHeader.svelte';
  import PageBackground from '$lib/components/PageBackground.svelte';
</script>

<svelte:head>
  <title>Settings — Budget Tracker</title>
</svelte:head>

<PageHeader title="Settings" />

<PageBackground />

<div class="placeholder-card">
  <div class="placeholder-icon">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  </div>
  <h2>Settings</h2>
  <p>User preferences and account settings coming soon.</p>
</div>

<style>
  .placeholder-card {
    text-align: center;
    padding: var(--space-2xl);
    background: var(--color-surface);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-xl);
    max-width: 480px;
    margin: var(--space-xl) auto;
  }

  .placeholder-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto var(--space-md);
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-primary-light) 0%, rgba(99, 102, 241, 0.1) 100%);
    color: var(--color-primary);
    border-radius: var(--radius-lg);
  }

  .placeholder-card h2 {
    margin: 0 0 var(--space-xs);
    font-size: var(--font-size-xl);
  }

  .placeholder-card p {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin: 0;
  }
</style>
