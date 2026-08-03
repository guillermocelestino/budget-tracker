# Refine Transactions PDF export formatting

## Goal

Make the Transactions **PDF export** (`generateTransactionPdf` in
`src/lib/utils/pdf.ts`) more print-friendly:

1. No leading `+` / `−` signs and no currency symbol on any amount.
2. All monetary values rendered in **black** (no teal / coral / green / red).
3. Keep thousands separators and two decimals.
4. Redesign the summary strip: full width, labels left / values right,
   balanced fonts, consistent row padding.
5. App UI untouched; everything else in the PDF (header band, table,
   borders, footer) unchanged.

## Current state (verified in code)

- `src/routes/api/transactions/export` returns amounts as **positive** numbers
  (`type` distinguishes income vs expense; `net = income - expenses`).
- Amounts are rendered with `formatCurrency()` → `₱1,250.00` (never a `+`;
  `−` only for negative inputs, which the PDF avoids via `Math.abs`).
- Semantic colors in the PDF:
  - Summary box: Total Income → `teal`, Total Expenses → `ink`, Net → `teal`/`coral`.
  - Table: amount cells forced to `teal` (income) / `coral` (expense) via `didParseCell`.

## Changes

1. **New helper** `formatPlainAmount()` in `src/lib/utils/format.ts` — same
   locale/separators/two-decimals logic as `formatCurrency`, but returns a
   plain figure (`1,250.00`) with no currency symbol and no sign.
2. `src/lib/utils/pdf.ts`, `generateTransactionPdf`:
   - Add `const black = [0, 0, 0] as const;`, remove now-unused `coral`.
   - Summary box — all three values use `formatPlainAmount` and `...black`:
     Total Income, Total Expenses, Net Balance (no more `netColor` ternary;
     `formatPlainAmount` abs's internally, so no `−` can appear).
   - Table — amount cell uses `formatPlainAmount(t.amount)`;
     `didParseCell` sets `[...black]` instead of teal/coral.
   - **Summary strip redesign** — box now spans the full content width
     (`boxX = m`, `boxW = pw - 2m`, `boxH = 30`); labels left-anchored at
     `labelX = boxX + 14`, values right-anchored at `valueX = boxX + boxW - 14`
     with `align: 'right'`; labels 8pt / values 10pt; row spacing `rowH2 = 9`
     with symmetric 6mm top/bottom padding.
   - Date / description / category cells and the rest of the layout untouched.
   - `generateReportPdf` still imports/uses `formatCurrency` (unchanged).

## Out of scope

- `generateReportPdf` (Reports page) shares the same color scheme but is a
  separate export; not touched per the task scope (Transactions PDF only).
- No changes to the API endpoints or the app UI.

## Verification

1. `npm run check` — no new errors (13 pre-existing, none in `pdf.ts`/`format.ts`).
2. `/transactions` → overflow menu → Export PDF → open the download:
   - summary strip spans the full content width; labels flush left, values
     flush right, decimals aligned; 8pt labels / 10pt values, even row spacing;
   - summary values black, plain figures (`1,250.00`) — no `₱`, no `+`/`−`;
   - table amounts black, plain figures — no `₱`, no `+`/`−`;
   - comma separators + two decimals intact;
   - header band, table, borders, footer unchanged.
