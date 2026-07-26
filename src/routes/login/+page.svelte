<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	
	let data = $derived($page.data as App.PageData);
	let error = $derived(($page.form as { error?: string } | null)?.error ?? '');
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Login — Budget Tracker</title>
</svelte:head>

<div class="login-page">
	<!-- Decorative background elements -->
	<div class="bg-gradient"></div>
	<div class="bg-grid"></div>
	<div class="floating-shape shape-1"></div>
	<div class="floating-shape shape-2"></div>
	<div class="floating-shape shape-3"></div>

	<div class="login-card">
		<!-- Logo/Brand Section -->
		<div class="login-header">
			<div class="logo-container">
				<div class="logo-icon">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
					</svg>
				</div>
			</div>
			<h1 class="login-title">Welcome Back</h1>
			<p class="login-subtitle">Sign in to manage your finances</p>
		</div>

		<form method="POST" use:enhance={() => {
			isLoading = true;
			return async ({ result }) => {
				isLoading = false;
				if (result.type === 'redirect') {
					await applyAction(result);
					return;
				}
				if (result.type === 'failure') {
					await applyAction(result);
					return;
				}
				if (result.type === 'success') {
					const data = result.data as { redirect?: string };
					if (data?.redirect) {
						await applyAction(result);
						window.location.href = data.redirect;
						return;
					}
				}
			};
		}}>
			{#if error}
				<div class="error-message">
					<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
					</svg>
					{error}
				</div>
			{/if}

			<div class="form-group">
				<label for="username" class="form-label">
					<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
					</svg>
					Username
				</label>
				<div class="input-wrapper">
					<input
						id="username"
						name="username"
						type="text"
						required
						autocomplete="username"
						placeholder="Enter your username"
					/>
				</div>
			</div>

			<div class="form-group">
				<label for="password" class="form-label">
					<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
					</svg>
					Password
				</label>
				<div class="input-wrapper">
					<input
						id="password"
						name="password"
						type="password"
						required
						autocomplete="current-password"
						placeholder="Enter your password"
					/>
				</div>
			</div>

			<div class="form-options">
				<label class="remember-me">
					<input type="checkbox" />
					<span>Remember me</span>
				</label>
				<a href="#forgot" class="forgot-link">Forgot password?</a>
			</div>

			<button type="submit" class="btn-login" disabled={isLoading}>
				{#if isLoading}
					<span class="spinner"></span>
					Signing in...
				{:else}
					<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clip-rule="evenodd"/>
					</svg>
					Sign In
				{/if}
			</button>
		</form>
<!-- 
		<div class="login-footer">
			<p>Don't have an account? <a href="/register">Create one</a></p>
		</div> -->
	</div>

	<!-- Trust indicators -->
	<div class="trust-badges">
		<span class="badge">
			<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
			</svg>
			Secure Login
		</span>
		<span class="badge">
			<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
			</svg>
			Encrypted Data
		</span>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-lg);
		position: relative;
		overflow: hidden;
	}

	/* Animated gradient background */
	.bg-gradient {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
		background-size: 400% 400%;
		animation: gradientShift 15s ease infinite;
		z-index: -3;
	}

	@keyframes gradientShift {
		0% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
		100% { background-position: 0% 50%; }
	}

	/* Grid pattern overlay */
	.bg-grid {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
		background-size: 50px 50px;
		z-index: -2;
	}

	/* Floating decorative shapes */
	.floating-shape {
		position: fixed;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(60px);
		z-index: -1;
		animation: float 20s ease-in-out infinite;
	}

	.shape-1 {
		width: 400px;
		height: 400px;
		top: -100px;
		right: -100px;
		animation-delay: 0s;
	}

	.shape-2 {
		width: 300px;
		height: 300px;
		bottom: -50px;
		left: -50px;
		animation-delay: -7s;
	}

	.shape-3 {
		width: 200px;
		height: 200px;
		top: 50%;
		left: 20%;
		animation-delay: -14s;
	}

	@keyframes float {
		0%, 100% { transform: translate(0, 0) rotate(0deg); }
		25% { transform: translate(20px, -30px) rotate(5deg); }
		50% { transform: translate(-10px, 20px) rotate(-5deg); }
		75% { transform: translate(30px, 10px) rotate(3deg); }
	}

	/* Login card */
	.login-card {
		width: 100%;
		max-width: 420px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(20px);
		border-radius: var(--radius-xl);
		padding: var(--space-2xl);
		box-shadow:
			0 25px 50px -12px rgba(0, 0, 0, 0.25),
			0 0 0 1px rgba(255, 255, 255, 0.1);
		animation: cardEntrance 0.6s ease-out;
	}

	@keyframes cardEntrance {
		from {
			opacity: 0;
			transform: translateY(30px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.login-header {
		text-align: center;
		margin-bottom: var(--space-xl);
	}

	.logo-container {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
		border-radius: var(--radius-lg);
		margin-bottom: var(--space-lg);
		box-shadow: 0 10px 30px -5px rgba(99, 102, 241, 0.5);
		animation: logoFloat 3s ease-in-out infinite;
	}

	@keyframes logoFloat {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-5px); }
	}

	.logo-icon {
		color: white;
	}

	.login-title {
		font-size: var(--font-size-2xl);
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--space-xs);
		letter-spacing: -0.02em;
	}

	.login-subtitle {
		font-size: var(--font-size-base);
		color: var(--color-text-secondary);
	}

	.error-message {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
		color: var(--color-expense);
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		margin-bottom: var(--space-md);
		border: 1px solid rgba(239, 68, 68, 0.2);
		animation: shake 0.5s ease-in-out;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-5px); }
		75% { transform: translateX(5px); }
	}

	.form-group {
		margin-bottom: var(--space-md);
	}

	.form-label {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--space-xs);
	}

	.form-label svg {
		color: var(--color-text-secondary);
	}

	.input-wrapper {
		position: relative;
	}

	input {
		width: 100%;
		padding: 14px 16px;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-family: inherit;
		background: var(--color-bg);
		color: var(--color-text);
		transition: all var(--transition-fast);
	}

	input::placeholder {
		color: var(--color-text-secondary);
		opacity: 0.6;
	}

	input:focus {
		outline: none;
		border-color: var(--color-primary);
		background: white;
		box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
	}

	.form-options {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-lg);
	}

	.remember-me {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		cursor: pointer;
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.remember-me input {
		width: 18px;
		height: 18px;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.forgot-link {
		font-size: var(--font-size-sm);
		color: var(--color-primary);
		font-weight: 500;
	}

	.forgot-link:hover {
		text-decoration: underline;
	}

	.btn-login {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		width: 100%;
		padding: 14px var(--space-lg);
		background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
		color: white;
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		min-height: 50px;
		box-shadow: 0 4px 15px -3px rgba(99, 102, 241, 0.4);
	}

	.btn-login:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px -5px rgba(99, 102, 241, 0.5);
	}

	.btn-login:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-login:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.login-footer {
		margin-top: var(--space-xl);
		text-align: center;
		font-size: var(--font-size-sm);
		color: var(--color-text-secondary);
	}

	.login-footer a {
		color: var(--color-primary);
		font-weight: 600;
	}

	.login-footer a:hover {
		text-decoration: underline;
	}

	/* Trust badges */
	.trust-badges {
		display: flex;
		gap: var(--space-lg);
		margin-top: var(--space-xl);
		animation: fadeIn 0.8s ease-out 0.3s backwards;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.badge {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--font-size-xs);
		color: rgba(255, 255, 255, 0.8);
		font-weight: 500;
	}

	.badge svg {
		opacity: 0.9;
	}

	/* Responsive */
	@media (max-width: 480px) {
		.login-card {
			padding: var(--space-lg);
		}

		.form-options {
			flex-direction: column;
			gap: var(--space-sm);
			align-items: flex-start;
		}

		.trust-badges {
			flex-direction: column;
			align-items: center;
			gap: var(--space-sm);
		}
	}
</style>