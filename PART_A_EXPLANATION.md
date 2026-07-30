# Part A — Event vs Object Row: Conceptual + Visual Difference

## Current State Summary (from code)

### `/transactions` → `TransactionList.svelte`
- **Row type:** Transaction = EVENT (flat, immutable, homogeneous)
- **Current rendering:** Date-grouped card list (sticky day headers + per-day count)
- **Columns visible:** Direction dot (SVG) | Description + category pill | Amount (mono, right-aligned, sign-colored)
- **Mobile (≤480px):** Condensed card feed — cream surface, 4px left accent border (teal income / coral expense), dashed divider
- **Interaction:** Click row → inline edit panel slides down (links to full edit page); hover → edit/delete icons; swipe → delete
- **Toggle:** NO user card/table toggle — only auto-card at ≤480px
- **Missing:** Running-balance column, per-day subtotal chip, cleared/reconciled column

### `/lending` + `/borrowed` → `ActiveIouList.svelte` (card) + inline table in page
- **Row type:** Lending/Borrowing = STATEFUL OBJECT (relationship with lifecycle)
- **Card view (default, user-toggable):** Rich card per IOU
  - Left 4px accent bar = STATE (teal on-track / coral overdue / sky paid)
  - Direction arrow icon in tinted circle
  - Name + metadata line (date lent, due date, interest %, notes)
  - Overdue badge ("N days overdue" in coral)
  - Large tabular-mono amount (teal for lent, coral for borrowed)
  - Hover actions: Edit | Mark Paid (gold CTA) | Delete
  - Paid rows: strikethrough name, muted amount, "Recovered" sky pill
  - Overdue rows: coral border + `boom-pulse` animation
- **Table view (user-toggable via view-toggle):** Flat `<table>`
  - Columns: Borrower/Lender | Amount | Interest | Date Lent | Due Date | Status badge | Actions
  - **MISSING lifecycle columns:** no progress bar, no countdown, no state pill — just flat data
- **Tabs:** Active / Paid (server-provided)
- **Toggle:** YES — user-controlled card ↔ table toggle in header

### `CategoryUsageBar.svelte` (progress primitive)
- 8px track, pill radius, animated width (600ms ease)
- Status-driven fill: `ok` = teal gradient, `warn` = gold gradient + `--glow-gold`, `over` = coral gradient + `--glow-coral` + `boom-pulse`
- Respects `prefers-reduced-motion`

---

## Conceptual Distinction: Two Kinds of Row

### TRANSACTION ROW = an EVENT
- **Flat, immutable, homogeneous:** one signed amount + category + date + merchant
- **Looks the same tomorrow:** no derived state that changes without an edit
- **User intent:** scan / filter / sort / sum — the "bank register" mental model
- **Wants:** dense uniform table, running balance, day grouping, inline edit
- **Color = SIGN** (teal income / coral expense)

### LENDING/BORROWED ROW = a STATEFUL OBJECT
- **Relationship with lifecycle:** Active → Repaid → Paid
- **Clock-derived fields recompute daily with NO edit:**
  - `outstanding = amount − repaid` (if partial repayment tracked)
  - `daysOverdue = today − dueDate`
  - `progress = repaid / amount`
  - `countdown = dueDate − today` ("due in N days" / "DUE TODAY" / "N days OVERDUE")
- **Heterogeneous emphasis:** on-track vs overdue need different visual weight
- **User intent:** triage / act / track — "receivables dashboard" mental model
- **Wants:** rich card as primary, table only as secondary compact scan
- **Color = STATE** (teal on-track / gold due-soon / coral overdue / sky cleared)

---

## Design Consequences

| Aspect | Transaction (Event) | Lending/Borrowed (Object) |
|--------|--------------------|---------------------------|
| **Row height** | Compact (~56px) — dense register | Taller (~68–80px) — rich card |
| **Primary text** | Description + category | Counterparty name |
| **Secondary text** | None (or date in group header) | Metadata line (date, due, interest, notes) |
| **Progress affordance** | None | Inline bar/ring (repaid ÷ amount) |
| **Color meaning** | Sign (income/expense) | State (on-track/due/overdue/paid) |
| **Tap action** | Inline edit / open edit page | Act (Mark Paid) / Edit |
| **Mobile (≤480px)** | Condensed card feed (cream, left bar) | Stays a card — never flattens to table |
| **Grouping** | Sticky day headers + per-day subtotal | Triage buckets: OVERDUE / DUE THIS WEEK / LATER + PAID tab |

---

## Current Toggle State

| Page | Card/Table Toggle? |
|------|-------------------|
| `/transactions` | **NO** — only auto-card at ≤480px |
| `/lending` | **YES** — `viewMode` state, icon buttons in header |
| `/borrowed` | **YES** — same as lending |

---

## Flip7 Tokens Already Defined (variables.css)

- Colors: `--color-teal`/`--color-teal-bg`, `--color-coral`/`--color-coral-light`, `--color-gold`/`--color-gold-dark`, `--color-sky`, `--color-cream`, `--color-hairline`
- Radii: `--radius-pill` (999px), `--radius-xl` (16px)
- Shadows/Glows: `--glow-card`, `--glow-gold`, `--glow-coral`, `--glow-sky`, `--shadow-card`
- Motion: `--ease` (cubic-bezier), `--bounce`, `--transition-fast/normal/slow`
- Typography: `--font-display` (Fredoka/Nunito), `--font-body` (Nunito Sans), `--font-mono` (JetBrains Mono)
- Reduced-motion: zeroes transitions + animations