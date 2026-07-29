<div class="page-background">
	<div class="bg-teal-wash"></div>
	<div class="bg-glow-top"></div>
	<div class="bg-glow-bottom"></div>
	<div class="bg-dots"></div>
	<div class="bg-grain"></div>
</div>

<style>
	.page-background {
		position: fixed;
		top: 0;
		left: var(--sidebar-width);
		right: 0;
		bottom: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
		background: var(--color-bg);
	}

	/* ── L1: Teal wash ── */
	.bg-teal-wash {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse 80% 60% at 50% 0%, var(--color-teal-bg) 0%, transparent 70%);
	}

	/* ── L1: Slow-drifting teal radial glow top ── */
	.bg-glow-top {
		position: absolute;
		top: -200px;
		right: -100px;
		width: 600px;
		height: 600px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(43, 168, 162, 0.10) 0%, transparent 65%);
		animation: drift 22s ease-in-out infinite;
	}

	/* ── L1: Faint gold radial glow bottom-corner ── */
	.bg-glow-bottom {
		position: absolute;
		bottom: -120px;
		left: 5%;
		width: 450px;
		height: 450px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 210, 63, 0.07) 0%, transparent 70%);
		animation: drift 28s ease-in-out infinite alternate;
	}

	@keyframes drift {
		0% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(35px, -25px) scale(1.05); }
		66% { transform: translate(-20px, 15px) scale(0.97); }
		100% { transform: translate(0, 0) scale(1); }
	}

	/* ── L2: Dotted game-board texture ── */
	.bg-dots {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, var(--color-teal) 1.5px, transparent 1.5px);
		background-size: 24px 24px;
		opacity: 0.04;
	}

	/* ── L3: Faint film grain ── */
	.bg-grain {
		position: absolute;
		inset: 0;
		opacity: 0.035;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E");
		background-repeat: repeat;
		background-size: 300px 300px;
		pointer-events: none;
	}

	[data-theme="dark"] .bg-grain {
		opacity: 0.05;
	}

	[data-theme="dark"] .bg-dots {
		opacity: 0.05;
	}

	[data-theme="dark"] .bg-glow-top {
		background: radial-gradient(circle, rgba(60, 196, 189, 0.12) 0%, transparent 65%);
	}

	[data-theme="dark"] .bg-glow-bottom {
		background: radial-gradient(circle, rgba(255, 210, 63, 0.08) 0%, transparent 70%);
	}

	@media (max-width: 768px) {
		.page-background { left: 0; }
		.bg-glow-top, .bg-glow-bottom { animation: none; }
		.bg-teal-wash { opacity: 0.6; }
	}

	@media (prefers-reduced-motion: reduce) {
		.bg-glow-top,
		.bg-glow-bottom {
			animation: none;
		}
	}
</style>
