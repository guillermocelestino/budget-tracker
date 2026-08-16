<script lang="ts">
	import { page } from '$app/stores';
	import PageHeader from '$lib/client/components/PageHeader.svelte';
	import PageBackground from '$lib/client/components/PageBackground.svelte';
	import SettingsSection from '$lib/client/components/SettingsSection.svelte';
	import SettingsForm from '$lib/client/components/SettingsForm.svelte';

	let data = $derived($page.data as App.PageData);
	let username = $derived(data?.user?.username ?? 'User');
</script>

<svelte:head>
	<title>Settings — Budget Tracker</title>
</svelte:head>

<PageHeader title="Settings">
	{#snippet subtitle()}
		<span class="header-subtitle">Customize your experience</span>
	{/snippet}
</PageHeader>

<PageBackground />

<div class="page-container page-container--compact">
	<div class="settings-layout">
	<!-- ═══ Profile Section ═══ -->
	<SettingsSection label="Profile">
		<div class="profile-card">
			<div class="profile-avatar">
				{username.charAt(0).toUpperCase()}
			</div>
			<div class="profile-info">
				<span class="profile-name">{username}</span>
				<span class="profile-role">Single user account</span>
			</div>
		</div>
	</SettingsSection>

	<!-- ═══ Preferences Section ═══ -->
	<SettingsSection label="Preferences">
		<div class="prefs-card">
			<SettingsForm />
		</div>
	</SettingsSection>

	<!-- ═══ Data Section ═══ -->
	<SettingsSection label="Data">
		<div class="data-card">
			<a href="/api/reports/export" class="data-action" download>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
					<polyline points="7 10 12 15 17 10"/>
					<line x1="12" x2="12" y1="15" y2="3"/>
				</svg>
				<span>Export All Transactions (CSV)</span>
			</a>
			<a href="/transactions" class="data-action">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
					<polyline points="14 2 14 8 20 8"/>
				</svg>
				<span>Import Transactions (CSV)</span>
			</a>
		</div>
	</SettingsSection>

	<!-- ═══ Security Section ═══ -->
	<SettingsSection label="Security">
		<div class="data-card">
			<div class="data-action passkey-placeholder">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
					<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
				</svg>
				<span>Passkey / Biometric</span>
				<span class="chip-coming">Coming soon</span>
			</div>
		</div>
	</SettingsSection>

	<!-- ═══ Sign Out ═══ -->
	<SettingsSection>
		<a href="/logout" class="sign-out-btn">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
				<polyline points="16 17 21 12 16 7"/>
				<line x1="21" x2="9" y1="12" y2="12"/>
			</svg>
			Sign Out
		</a>
	</SettingsSection>
</div>
</div>

<style>
	.header-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		font-weight: 400;
	}

	.settings-layout {
		max-width: var(--container-compact); /* 720px — compact tier */
		margin-inline: auto;
	}

	/* ─── Profile card ─── */
	.profile-card {
		display: flex;
		align-items: center;
		gap: var(--space-lg);
		padding: var(--space-lg);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-left: 4px solid var(--color-teal);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-card);
	}

	.profile-avatar {
		width: 48px;
		height: 48px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--color-teal), var(--color-teal-dark));
		color: white;
		border-radius: var(--radius-md);
		font-family: var(--font-display);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		flex-shrink: 0;
		box-shadow: var(--glow-card);
	}

	.profile-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.profile-name {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		color: var(--color-ink);
	}

	.profile-role {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	/* ─── Preferences card ─── */
	.prefs-card {
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		padding: var(--space-lg);
		box-shadow: var(--shadow-card);
	}

	/* ─── Data section ─── */
	.data-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		padding: var(--space-md);
		box-shadow: var(--shadow-card);
	}

	.data-action {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		color: var(--color-ink);
		text-decoration: none;
		font-size: var(--font-size-sm);
		font-weight: 600;
		min-height: 44px;
		transition: all 150ms var(--ease);
	}

	.data-action:hover {
		background: var(--color-teal-bg);
		color: var(--color-teal);
		text-decoration: none;
	}

	.data-action svg {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.data-action:hover svg {
		color: var(--color-teal);
	}

	.passkey-placeholder {
		opacity: 0.6;
		cursor: default;
	}

	.passkey-placeholder:hover {
		background: transparent;
		color: var(--color-ink);
	}

	.passkey-placeholder:hover svg {
		color: var(--color-text-muted);
	}

	.chip-coming {
		margin-left: auto;
		padding: 2px 10px;
		background: var(--color-teal-bg);
		color: var(--color-teal-dark);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-xs);
		font-weight: 600;
		font-family: var(--font-display);
	}

	/* ─── Sign out ─── */
	.sign-out-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-lg);
		background: rgba(239, 108, 74, 0.08);
		color: var(--color-coral);
		border: 1px solid rgba(239, 108, 74, 0.2);
		border-radius: var(--radius-pill);
		text-decoration: none;
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		min-height: 48px;
		transition: all 200ms var(--ease);
		box-shadow: var(--glow-coral);
	}

	.sign-out-btn:hover {
		background: var(--color-coral);
		color: white;
		text-decoration: none;
		box-shadow: 0 6px 24px rgba(239, 108, 74, 0.40);
		transform: translateY(-1px);
	}

	.sign-out-btn:active {
		transform: scale(0.97);
	}

	@media (max-width: 480px) {
		.settings-layout {
			max-width: none;
		}
	}
</style>
