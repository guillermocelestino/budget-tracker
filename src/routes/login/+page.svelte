<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	let data = $derived($page.data as App.PageData);
	let error = $derived(($page.form as { error?: string } | null)?.error ?? '');
</script>

<svelte:head>
	<title>Login — Budget Tracker</title>
</svelte:head>

<div class="login-page">
	<div class="login-card">
		<div class="login-header">
			<span class="login-icon">💰</span>
			<h1 class="login-title">Budget Tracker</h1>
			<p class="login-subtitle">Sign in to your account</p>
		</div>

		<form method="POST" use:enhance>
			{#if error}
				<div class="error-message">{error}</div>
			{/if}

			<div class="form-group">
				<label for="username" class="form-label">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					required
					autocomplete="username"
					placeholder="Enter your username"
				/>
			</div>

			<div class="form-group">
				<label for="password" class="form-label">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					autocomplete="current-password"
					placeholder="Enter your password"
				/>
			</div>

			<button type="submit" class="btn-login">Sign In</button>
		</form>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: calc(100vh - var(--space-lg) * 2);
		padding: var(--space-md);
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		box-shadow: var(--shadow-sm);
	}

	.login-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.login-icon {
		font-size: 3rem;
		display: block;
		margin-bottom: var(--space-md);
	}

	.login-title {
		font-size: var(--font-size-xl);
		color: var(--color-primary);
		margin-bottom: var(--space-xs);
	}

	.login-subtitle {
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.error-message {
		background: var(--color-expense);
		color: white;
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-md);
		text-align: center;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: var(--space-md);
	}

	.form-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
	}

	input {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-base);
		font-family: inherit;
		background: var(--color-bg);
		color: var(--color-text);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
		width: 100%;
		min-height: 44px;
	}

	input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px var(--color-primary-light);
	}

	.btn-login {
		width: 100%;
		padding: 12px var(--space-lg);
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
		margin-top: var(--space-md);
		min-height: 44px;
	}

	.btn-login:hover {
		background: var(--color-primary-hover);
	}

	.btn-login:active {
		transform: scale(0.98);
	}
</style>
