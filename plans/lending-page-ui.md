# Plan: Lending Page UI Enhancement

## Context
The lending page needs a premium, polished UI matching the login page's visual quality. This page doesn't exist yet — it will be built from the lending module plan. The UI should be consistent with the other app pages after the shared UI enhancement plan is applied (`PageBackground`, glassmorphism, gradient buttons, entrance animations).

## Design Direction
Match the login page's premium feel with:
- Animated gradient background (subtle, since page is inside app layout)
- Glassmorphism cards for the lending form and lending cards
- Gradient section headers
- Entrance animations for cards and list items
- Hover lift effects on lending cards
- Status badges with color-coded gradients
- "Mark as Paid" button with gradient style

## Layout Structure

```
/lending page
├── <PageHeader> (title: "Lending", subtitle: "Track your receivables")
├── <PageBackground />  ← shared component
├── LendingSummaryCards  ← Total Lent, Recovered, Outstanding
├── LendingsTabs         ← "Active" | "Paid" tab switcher
├── LendingsGrid
│   ├── LendingCard (for each active loan)
│   │   ├── Borrower name + avatar initial
│   │   ├── Amount (large, prominent)
│   │   ├── Date lent + due date
│   │   ├── Interest rate badge
│   │   ├── Status badge (active/paid)
│   │   ├── Notes (if any)
│   │   └── Actions: Edit | Mark Paid
│   └── AddLendingCard (dashed border, + icon)
├── LendingForm (slide-in panel, glassmorphic)
├── MarkPaidModal (glassmorphic confirmation dialog)
└── EmptyState (illustration + CTA when no lendings)
```

## Visual Specifications

### Summary Cards Row
3 cards in a grid — Total Lent (primary), Recovered (income-green), Outstanding (warning-red). Glassmorphism background.

```svelte
// LendingSummaryCards.svelte
<div class="summary-card">
  <div class="card-icon">  <!-- gradient, like SummaryCards -->
    <svg>💰</svg>
  </div>
  <div class="card-content">
    <span class="card-label">Total Lent</span>
    <span class="card-value">{formatCurrency(totalLent)}</span>
  </div>
</div>
```

### Glassmorphic Lending Card
```css
.lending-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
    transition: all 200ms ease;
    animation: cardEntrance 0.5s ease-out backwards;
}

.lending-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
    border-color: rgba(99, 102, 241, 0.3);
}
```

### Status Badges
```css
.badge-active {
    background: linear-gradient(135deg, #fef3c7, #fde68a);
    color: #92400e;
    border: 1px solid rgba(245, 158, 11, 0.3);
}

.badge-paid {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #065f46;
    border: 1px solid rgba(16, 185, 129, 0.3);
}
```

### Gradient "Mark as Paid" Button
```css
.btn-paid {
    background: linear-gradient(135deg, var(--color-income) 0%, #34d399 100%);
    color: white;
    box-shadow: 0 4px 15px -3px rgba(16, 185, 129, 0.4);
}

.btn-paid:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px -5px rgba(16, 185, 129, 0.5);
}
```

### Tabs (Active / Paid)
Pill-style tab switcher with animated active indicator:

```css
.tab-active {
    background: var(--color-primary);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.tab-inactive {
    background: transparent;
    color: var(--color-text-secondary);
}

.tab-inactive:hover {
    background: var(--color-bg);
    color: var(--color-text);
}
```

### Empty State
Glassmorphic card with centered illustration:
```svelte
<div class="empty-state">
    <div class="empty-illustration">📋</div>
    <h3>No lendings yet</h3>
    <p>Start tracking money you lent out</p>
    <button class="btn-gradient">Add Your First Lending</button>
</div>
```

## Component File Structure

| Component | File | Description |
|---|---|---|
| Summary cards | `LendingSummaryCards.svelte` | 3-card grid with icons |
| Lending card | `LendingCard.svelte` | Individual loan display |
| Lending list | `LendingList.svelte` | Grid of cards + tabs |
| Form panel | `LendingForm.svelte` | Slide-in glassmorphic form |
| Mark paid modal | `LendingMarkPaidModal.svelte` | Confirmation dialog |

## Animations

- **Page load**: Summary cards slide in with stagger delay (0.1s each)
- **Card grid**: Cards fade-in with stagger (0.05s per card)
- **Form panel**: Slide in from right with backdrop blur overlay
- **Modal**: Fade + scale in (0.3s)
- **Mark as Paid button**: Subtle pulse animation when status is overdue

## Integration with App UI Enhancement
Once the shared UI enhancement plan is applied:
- `PageBackground` component already handles animated gradient + floating shapes
- Glassmorphism utility classes can be reused across components
- Gradient button styles should be centralized in a shared CSS file

## Verification
1. Navigate to `/lending`
2. Summary cards animate in with stagger effect
3. Lending cards have glassmorphism + hover lift
4. Status badges use correct gradient colors
5. Form panel slides in with backdrop blur
6. Empty state shows with illustration and CTA button
7. Tabs switch smoothly with animated indicator