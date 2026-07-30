<div class="page-background">
  <!-- ═══ LIGHT MODE layers (untouched) ═══ -->

  <!-- L1: Teal wash -->
  <div class="bg-teal-wash"></div>

  <!-- L1: Slow-drifting teal radial glow top -->
  <div class="bg-glow-top"></div>

  <!-- L1: Faint gold radial glow bottom-corner -->
  <div class="bg-glow-bottom"></div>

  <!-- L2: Dotted game-board texture -->
  <div class="bg-dots"></div>

  <!-- L3: Faint film grain (shared, slight dark bump) -->
  <div class="bg-grain"></div>

  <!-- ═══ DARK MODE only ambient stack (hidden in light) ═══ -->

  <!-- L1: Dark vignette — edges darken, upper-center lifts -->
  <div class="bg-vignette-dark"></div>

  <!-- L2: Brand-tinted ambient glow, slow-drift -->
  <div class="bg-ambient-dark"></div>

  <!-- L3: Starfield pinpricks -->
  <div class="bg-starfield-dark"></div>
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

  /* ═══ LIGHT MODE ambient layers (hidden in dark) ═══ */

  .bg-teal-wash {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 0%, var(--color-teal-bg) 0%, transparent 70%);
  }

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

  .bg-dots {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, var(--color-teal) 1.5px, transparent 1.5px);
    background-size: 24px 24px;
    opacity: 0.04;
  }

  .bg-grain {
    position: absolute;
    inset: 0;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 300px 300px;
    pointer-events: none;
  }

  /* ═══ DARK MODE ambient stack ═══
       Light layers hidden; new stack layered over the midnight ink.
       All dark layers are pointer-events:none, behind content.
  ══════════════════════════════════════════════ */

  [data-theme="dark"] .bg-teal-wash {
    display: none;
  }

  [data-theme="dark"] .bg-glow-top {
    display: none;
  }

  [data-theme="dark"] .bg-glow-bottom {
    display: none;
  }

  [data-theme="dark"] .bg-dots {
    display: none;
  }

  [data-theme="dark"] .bg-grain {
    opacity: 0.025;
  }

  /* L1: Vignette — edge darken + top lift */
  [data-theme="dark"] .bg-vignette-dark {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.035) 0%, transparent 60%),
      radial-gradient(140% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.30) 100%);
    pointer-events: none;
  }

  /* L2: Brand-tinted teal ambient glow, slow-drift */
  [data-theme="dark"] .bg-ambient-dark {
    position: absolute;
    inset: 0;
    background: radial-gradient(60% 50% at 50% 0%, rgba(43,168,162,0.08) 0%, transparent 70%);
    pointer-events: none;
    animation: dark-glow-drift 45s ease-in-out infinite;
  }

  @keyframes dark-glow-drift {
    0%   { transform: translate(0, 0) scale(1); opacity: 1; }
    25%  { transform: translate(20px, -15px) scale(1.03); opacity: 0.9; }
    50%  { transform: translate(-15px, 10px) scale(0.98); opacity: 1; }
    75%  { transform: translate(10px, -10px) scale(1.02); opacity: 0.92; }
    100% { transform: translate(0, 0) scale(1); opacity: 1; }
  }

  /* L3: Starfield pinpricks — fine white dots */
  [data-theme="dark"] .bg-starfield-dark {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px);
    background-size: 25px 25px;
    pointer-events: none;
  }

  @media (max-width: 768px) {
    .page-background { left: 0; }
    .bg-glow-top, .bg-glow-bottom { animation: none; }
    .bg-teal-wash { opacity: 0.6; }
    [data-theme="dark"] .bg-ambient-dark { animation: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .bg-glow-top,
    .bg-glow-bottom,
    [data-theme="dark"] .bg-ambient-dark {
      animation: none;
    }
  }
</style>
