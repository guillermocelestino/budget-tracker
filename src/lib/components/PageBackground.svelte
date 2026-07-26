<div class="page-background">
	<div class="bg-gradient"></div>
	<div class="bg-grid"></div>
	<div class="floating-shape shape-1"></div>
	<div class="floating-shape shape-2"></div>
	<div class="floating-shape shape-3"></div>
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
	}

	.bg-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
		background-size: 400% 400%;
		animation: gradientShift 15s ease infinite;
		opacity: 0.06;
	}

	@keyframes gradientShift {
		0% { background-position: 0% 50%; }
		50% { background-position: 100% 50%; }
		100% { background-position: 0% 50%; }
	}

	.bg-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
			linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px);
		background-size: 50px 50px;
	}

	.floating-shape {
		position: absolute;
		border-radius: 50%;
		background: rgba(99, 102, 241, 0.06);
		backdrop-filter: blur(60px);
		animation: float 20s ease-in-out infinite;
	}

	.shape-1 {
		width: 400px; height: 400px;
		top: -100px; right: -100px;
	}

	.shape-2 {
		width: 300px; height: 300px;
		bottom: -50px; left: 20%;
		animation-delay: -7s;
	}

	.shape-3 {
		width: 200px; height: 200px;
		top: 40%; left: 60%;
		animation-delay: -14s;
	}

	@keyframes float {
		0%, 100% { transform: translate(0, 0) rotate(0deg); }
		25% { transform: translate(20px, -30px) rotate(5deg); }
		50% { transform: translate(-10px, 20px) rotate(-5deg); }
		75% { transform: translate(30px, 10px) rotate(3deg); }
	}

	@media (max-width: 768px) {
		.page-background { left: 0; }
		.floating-shape { display: none; }
		.bg-gradient { opacity: 0.04; }
	}
</style>
