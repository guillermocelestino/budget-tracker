---
name: apple-design
description: Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, translucent materials and depth, typography (optical sizing, tracking, leading), reduced-motion, or the design foundations (feedback, spatial consistency, restraint) behind Apple-style interfaces.
---

# Apple Design

How Apple builds interfaces that stop feeling like a computer and start feeling like an extension of you. Distilled from Apple's WWDC design talks (chiefly *Designing Fluid Interfaces* - WWDC 2018) and translated to web platforms (CSS, Pointer Events, `requestAnimationFrame`, Motion / Framer Motion / Svelte spring stores).

The through-line: **an interface feels alive when motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant.**

---

## 1. Response — Kill Latency

The moment lag appears, the feeling of directness falls off a cliff. Response is the foundation everything else is built on.

- **Respond on pointer-down, not on release.** Highlight a button the instant it's pressed. Waiting for `click`/touch-up to show feedback feels dead.
- **Be vigilant about every latency.** Audit debounces, artificial timers, transition waits, and tap delays.
- **Feedback must be continuous *during* interaction.** For a drag, slider, or drawer, update the UI 1:1 with the pointer the whole way through — never animate only when the gesture completes.

```css
/* Instant press feedback */
.button:active,
.card:active {
  transform: scale(0.97);
  transition: transform 100ms cubic-bezier(0.2, 0, 0, 1);
}
```

---

## 2. Direct Manipulation — 1:1 Tracking

> "Touch and content should move together."

When the user drags something, it must stay glued to the finger — and respect the offset from *where they grabbed it*.

- Use Pointer Events with `setPointerCapture` so tracking continues even when the pointer leaves the element's bounds.
- Track a short **velocity/position history** (last few `pointermove` events), not just the current point — you'll need velocity at release.

```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  const grabOffset = e.clientY - el.getBoundingClientRect().top;
  // track position + timestamp history for velocity calculation
});
```

---

## 3. Interruptibility — The Single Most Important Principle

> "The thought and the gesture happen in parallel."

Every animation must be interruptible and redirectable at any moment. A user must be able to grab a moving element mid-flight and reverse it without waiting for the animation to finish.

- **Never lock out input during a transition.**
- **Always animate from the *presentation* (current) value, never the target value.** Read live on-screen transforms on interrupt.
- **Avoid CSS transitions and `@keyframes` for gesture-driven UI.** Reach for spring physics (e.g. Svelte `spring` store or `motion`).
- **When a gesture reverses, blend velocity — don't hard-cut it.**

---

## 4. Behavior Over Animation — Use Springs

> "Think of animation as a conversation between you and the object, not something prescribed by the interface."

A spring has no fixed duration; its settle time emerges from parameters:

- **Damping ratio (`damping`)** — controls overshoot. `1.0` = critically damped (no bounce). `< 1.0` = overshoots.
- **Response / Stiffness (`stiffness`)** — how quickly the value reaches the target.

### Apple Benchmark Values

| Interaction | Damping | Response / Stiffness | Bounce |
| --- | --- | --- | --- |
| Move / Reposition | `1.0` | `0.4s` | `0` |
| Rotation / Tilt | `0.8` | `0.4s` | `0.1` |
| Drawer / Sheet | `0.8` | `0.3s` | `0.15` |

- Start most UI at **damping `1.0`** (critically damped) by default.
- Reserve overshoot (`damping ~0.8`) strictly for **momentum-driven flick releases**.

---

## 5. Velocity Handoff

When a gesture ends, the animation must **continue at the finger's exact velocity**, so there is zero visible seam between dragging and animating.

```js
// Relative velocity = gestureVelocity / (targetValue - currentValue)
const relativeVelocity = releaseVelocity / (target - current);
spring.set(target, { hard: false, velocity: relativeVelocity });
```

---

## 6. Momentum Projection

Project resting endpoints based on release velocity rather than snapping to the nearest point from release location:

```js
// Apple exponential decay projection (decelerationRate ≈ 0.998)
function project(initialVelocity, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

const projectedEndpoint = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projectedEndpoint);
```

---

## 7. Spatial Consistency

- **Enter and exit along symmetric paths.** If a drawer slides in from the bottom, it must dismiss to the bottom.
- **Anchor interactions to their origin.** Set `transform-origin` to the trigger element for popovers, context menus, and modals.
- **Mirror transition easing** so outbound paths match inbound paths seamlessly.

---

## 8. Glass, Depth & Materials

Apple UI makes heavy use of physical materials:
- **Translucent materials**: `backdrop-filter: blur(20px) saturate(180%)`.
- **Subtle borders**: 1px Hairline borders with subtle contrast (`rgba(255,255,255,0.15)` in dark mode, `rgba(0,0,0,0.08)` in light mode).
- **Elevated depth**: Layered shadows with multi-level blur (`box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)`).
- **Fluid typography**: Optical tracking, `-webkit-font-smoothing: antialiased`, tabular numbers for data/currency.
