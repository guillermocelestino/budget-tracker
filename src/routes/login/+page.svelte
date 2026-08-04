<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';

	let error = $derived(($page.form as { error?: string } | null)?.error ?? '');
	let isLoading = $state(false);
	let showPassword = $state(false);
</script>

<svelte:head>
	<title>Login — Budget Tracker</title>
</svelte:head>

<div class="login-page">
	<!-- Decorative teal-tinted background -->
	<div class="bg-texture"></div>
	<div class="bg-glow bg-glow--1"></div>
	<div class="bg-glow bg-glow--2"></div>

	<div class="login-card">
		<!-- Flip7 Hero — fanned cards behind skewed wordmark -->
		<div class="hero-area">
			<div class="brand-cards">
				<div class="fanned-card" style="--rot: -24deg; --bg: var(--color-teal)"></div>
				<div class="fanned-card" style="--rot: -12deg; --bg: var(--color-gold)"></div>
				<div class="fanned-card" style="--rot: 0deg; --bg: var(--color-coral)"></div>
				<div class="fanned-card" style="--rot: 12deg; --bg: var(--color-gold)"></div>
				<div class="fanned-card" style="--rot: 24deg; --bg: var(--color-teal)"></div>
			</div>
			<div class="wordmark-bg">
				<h1 class="wordmark">BUDGET<br>TRACKER</h1>
			</div>
		</div>

		<!-- Folded-ribbon tagline -->
		<div class="ribbon-banner"><span class="ribbon-text">TRACK &bull; SAVE &bull; WIN</span></div>

		<!-- Form — logic untouched, only visual styling changes -->
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
					const d = result.data as { redirect?: string };
					if (d?.redirect) {
						await applyAction(result);
						window.location.href = d.redirect;
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
						type={showPassword ? 'text' : 'password'}
						required
						autocomplete="current-password"
						placeholder="Enter your password"
					/>
					<button type="button" class="password-toggle" onclick={() => showPassword = !showPassword} aria-label={showPassword ? 'Hide password' : 'Show password'}>
						{#if showPassword}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
								<line x1="1" x2="23" y1="1" y2="23"/>
							</svg>
						{:else}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
								<circle cx="12" cy="12" r="3"/>
							</svg>
						{/if}
					</button>
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

		<!-- Passkey chip — decorative, no auth logic attached -->
		<button type="button" class="passkey-chip">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
				<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
			</svg>
			Continue with passkey
		</button>

		<!-- Trust badges — Flip7 style -->
		<div class="trust-badges">
			<span class="badge">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
				</svg>
				Secure
			</span>
			<span class="badge-dot"></span>
			<span class="badge">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
					<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
				</svg>
				Encrypted
			</span>
			<span class="badge-dot"></span>
			<span class="badge">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
				</svg>
				Local
			</span>
		</div>
	</div>
</div>

<style>
	/* ═══════════════════════════════════════════════════
	   FLIP7 LOGIN — "Arcade Day / Night Arcade"
	   ═══════════════════════════════════════════════════ */

	.login-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-lg);
		position: relative;
		overflow: hidden;
		background: var(--color-bg);
	}

	/* ── Background texture — subtle noise overlay ── */
	.bg-texture {
		position: fixed;
		inset: 0;
		z-index: -2;
		background-image:
			radial-gradient(ellipse at 20% 50%, rgba(43, 168, 162, 0.07) 0%, transparent 60%),
			radial-gradient(ellipse at 80% 20%, rgba(255, 210, 63, 0.05) 0%, transparent 50%),
			radial-gradient(ellipse at 50% 80%, rgba(239, 108, 74, 0.04) 0%, transparent 50%);
	}

	/* ── Floating glow orbs ── */
	.bg-glow {
		position: fixed;
		border-radius: 50%;
		filter: blur(70px);
		z-index: -1;
		pointer-events: none;
	}

	.bg-glow--1 {
		width: 420px;
		height: 420px;
		top: -120px;
		right: -80px;
		background: rgba(43, 168, 162, 0.10);
		animation: floatGlow1 18s ease-in-out infinite;
	}

	.bg-glow--2 {
		width: 340px;
		height: 340px;
		bottom: -100px;
		left: -100px;
		background: rgba(255, 210, 63, 0.08);
		animation: floatGlow2 22s ease-in-out infinite;
	}

	@keyframes floatGlow1 {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(30px, -40px) scale(1.1); }
		66% { transform: translate(-20px, 20px) scale(0.95); }
	}

	@keyframes floatGlow2 {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(-30px, 30px) scale(1.08); }
		66% { transform: translate(20px, -20px) scale(0.92); }
	}

	/* ═══ Login Card ═══ */
	.login-card {
		width: 100%;
		max-width: 400px;
		background: var(--color-surface);
		border: 1px solid var(--color-hairline);
		border-radius: var(--radius-xl);
		padding: var(--space-2xl) var(--space-xl) var(--space-xl);
		box-shadow: var(--shadow-card);
		animation: cardEnter 0.55s var(--bounce) backwards;
		position: relative;
		z-index: 1;
	}

	@keyframes cardEnter {
		from { opacity: 0; transform: translateY(28px) scale(0.96); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	/* ═══ Flip7 Hero — Fanned Cards + Wordmark ═══ */
	.hero-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 8px;
		position: relative;
	}

	/* Fanned bill/coin cards */
	.brand-cards {
		position: relative;
		width: 120px;
		height: 90px;
		z-index: 1;
		margin-bottom: -30px;
	}

	.fanned-card {
		position: absolute;
		left: 50%;
		bottom: 0;
		width: 46px;
		height: 64px;
		margin-left: -23px;
		background: var(--bg);
		border-radius: 5px;
		transform-origin: center bottom;
		transform: rotate(var(--rot));
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		animation: cardFanIn 0.45s var(--bounce) both;
	}

	.fanned-card:nth-child(1) { animation-delay: 0.02s; }
	.fanned-card:nth-child(2) { animation-delay: 0.06s; }
	.fanned-card:nth-child(3) { animation-delay: 0.10s; }
	.fanned-card:nth-child(4) { animation-delay: 0.14s; }
	.fanned-card:nth-child(5) { animation-delay: 0.18s; }

	@keyframes cardFanIn {
		from { opacity: 0; transform: rotate(var(--rot)) scale(0.7); }
		to { opacity: 1; transform: rotate(var(--rot)) scale(1); }
	}

	/* Skewed cream parallelogram wordmark */
	.wordmark-bg {
		position: relative;
		z-index: 2;
		transform: skewX(-8deg);
		background: var(--color-cream);
		border: 2.5px solid var(--color-ink);
		border-radius: 4px;
		padding: 10px 34px;
		box-shadow:
			0 4px 14px rgba(20, 48, 46, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.4);
		animation: wordmarkSlideIn 0.5s var(--bounce) 0.12s both;
	}

	@keyframes wordmarkSlideIn {
		from { opacity: 0; transform: skewX(-8deg) translateY(12px); }
		to { opacity: 1; transform: skewX(-8deg) translateY(0); }
	}

	.wordmark {
		transform: skewX(8deg);
		font-family: var(--font-display);
		font-weight: var(--font-weight-extrabold);
		font-size: var(--font-size-2xl);
		line-height: 1.05;
		text-align: center;
		letter-spacing: var(--letter-spacing-heading);
		color: var(--color-ink);
		margin: 0;
	}

	/* ═══ Folded-ribbon tagline ═══ */
	.ribbon-banner {
		position: relative;
		display: inline-block;
		background: var(--color-cream);
		border: 2px solid var(--color-ink);
		padding: 5px 24px;
		margin: 0 auto var(--space-xl);
		border-radius: 2px;
		animation: ribbonSlideIn 0.5s var(--bounce) 0.22s both;
	}

	/* Folded tails */
	.ribbon-banner::before,
	.ribbon-banner::after {
		content: '';
		position: absolute;
		top: 100%;
		width: 14px;
		height: 10px;
		background: var(--color-ink);
	}

	.ribbon-banner::before {
		left: -2px;
		clip-path: polygon(0 0, 0% 100%, 100% 100%);
		opacity: 0.7;
	}

	.ribbon-banner::after {
		right: -2px;
		clip-path: polygon(100% 0, 0% 100%, 100% 100%);
		opacity: 0.7;
	}

	@keyframes ribbonSlideIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.ribbon-text {
		font-family: var(--font-display);
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-xs);
		letter-spacing: 0.15em;
		color: var(--color-ink);
		white-space: nowrap;
	}

	/* ═══ Error Message ═══ */
	.error-message {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		background: rgba(239, 108, 74, 0.08);
		color: var(--color-coral);
		padding: 10px 14px;
		border: 1px solid rgba(239, 108, 74, 0.2);
		border-radius: var(--radius-md);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		margin-bottom: var(--space-md);
		animation: shake 0.4s ease-in-out;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-5px); }
		75% { transform: translateX(5px); }
	}

	/* ═══ Form ═══ */
	.form-group {
		margin-bottom: var(--space-md);
	}

	.form-label {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink);
		margin-bottom: var(--space-xs);
	}

	.form-label svg {
		color: var(--color-text-muted);
	}

	.input-wrapper {
		position: relative;
	}

	.password-toggle {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-muted);
		padding: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		transition: all var(--transition-fast);
		z-index: 1;
	}

	.password-toggle:hover {
		color: var(--color-teal);
		background: var(--color-teal-bg);
	}

	.input-wrapper input {
		padding-right: 44px;
	}

	/* Cream input surfaces with teal focus ring */
	input {
		width: 100%;
		padding: 14px 16px;
		border: 2px solid var(--color-hairline);
		border-radius: var(--radius-md);
		font-size: var(--font-size-base);
		font-family: var(--font-body);
		background: var(--color-cream);
		color: var(--color-ink);
		transition: all var(--transition-fast);
		appearance: none;
	}

	input::placeholder {
		color: var(--color-text-muted);
		opacity: 0.55;
	}

	input:focus {
		outline: none;
		border-color: var(--color-teal);
		box-shadow: var(--focus);
		background: var(--color-surface);
	}

	/* ═══ Form Options ═══ */
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
		color: var(--color-text-muted);
	}

	.remember-me input {
		width: 18px;
		height: 18px;
		accent-color: var(--color-teal);
		cursor: pointer;
		padding: 0;
		border-width: 1.5px;
	}

	.forgot-link {
		font-size: var(--font-size-sm);
		color: var(--color-teal);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		transition: all var(--transition-fast);
	}

	.forgot-link:hover {
		color: var(--color-teal-dark);
		text-decoration: underline;
	}

	/* ═══ Gold Gloss CTA Pill ═══ */
	.btn-login {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		width: 100%;
		padding: 14px var(--space-xl);
		background: linear-gradient(135deg, var(--color-gold) 0%, var(--color-gold-light) 100%);
		color: var(--color-ink);
		border: 2px solid var(--color-gold-dark);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-base);
		font-weight: var(--font-weight-bold);
		font-family: var(--font-body);
		cursor: pointer;
		transition: all var(--transition-fast);
		min-height: var(--touch-target-min);
		box-shadow: var(--glow-gold);
		letter-spacing: var(--letter-spacing-wide);
	}

	.btn-login:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow:
			0 6px 28px rgba(255, 210, 63, 0.5),
			0 0 0 4px rgba(255, 210, 63, 0.12);
	}

	.btn-login:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-login:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		box-shadow: none;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(20, 48, 46, 0.2);
		border-top-color: var(--color-ink);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* ═══ Passkey Chip ═══ */
	.passkey-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		width: 100%;
		padding: 12px var(--space-xl);
		background: var(--color-teal-bg);
		color: var(--color-teal-dark);
		border: 1.5px solid var(--color-teal);
		border-radius: var(--radius-pill);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		font-family: var(--font-body);
		cursor: pointer;
		transition: all var(--transition-fast);
		min-height: 44px;
		box-shadow: var(--glow-card);
		margin-top: var(--space-sm);
		letter-spacing: var(--letter-spacing-wide);
	}

	.passkey-chip:hover {
		background: var(--color-teal);
		color: white;
		box-shadow: var(--glow-card), 0 0 0 4px rgba(43, 168, 162, 0.15);
	}

	.passkey-chip svg {
		flex-shrink: 0;
	}

	/* ═══ Trust Badges ═══ */
	.trust-badges {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		margin-top: var(--space-lg);
		animation: fadeIn 0.6s ease-out 0.4s backwards;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.badge {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		font-weight: var(--font-weight-medium);
	}

	.badge svg {
		opacity: 0.7;
		flex-shrink: 0;
	}

	.badge-dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: var(--color-text-muted);
		opacity: 0.3;
		flex-shrink: 0;
	}

	/* ═══ Responsive ═══ */
	@media (max-width: 480px) {
		.login-card {
			padding: var(--space-xl) var(--space-lg) var(--space-lg);
		}

		.wordmark {
			font-size: var(--font-size-xl);
		}

		.wordmark-bg {
			padding: 8px 24px;
		}

		.brand-cards {
			width: 100px;
			height: 74px;
			margin-bottom: -24px;
		}

		.fanned-card {
			width: 38px;
			height: 52px;
			margin-left: -19px;
		}

		.form-options {
			flex-direction: column;
			gap: var(--space-sm);
			align-items: flex-start;
		}

		.ribbon-banner {
			padding: 4px 16px;
			margin-bottom: var(--space-lg);
		}

		.trust-badges {
			gap: var(--space-sm);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.login-card,
		.fanned-card,
		.wordmark-bg,
		.ribbon-banner,
		.trust-badges,
		.bg-glow {
			animation: none !important;
		}

		.fanned-card {
			opacity: 1;
		}
	}
</style>
