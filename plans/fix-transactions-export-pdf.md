# Fix: Transactions "Export PDF" not working

> **STATUS: Applied & verified** — see "Verification results" at the bottom.

## Root cause

`src/lib/utils/pdf.ts` line 112 in `generateTransactionPdf()`:

```ts
doc.setTextColor(summary.net >= 0 ? [...teal] : [...coral]);
```

This passes a **single array** to `doc.setTextColor()`. Every other color call in
the file spreads the tuple (`doc.setTextColor(...teal)`). jsPDF v4's
`setTextColor` does not accept an array — it throws at runtime:

```
Invalid argument passed to jsPDF.f3
```

The summary box is rendered on every run, so `generateTransactionPdf()` always
throws. `handleExport('pdf')` in `src/routes/transactions/+page.svelte` catches
it and shows the "Failed to generate PDF" toast — i.e. Export PDF never works.

**Why the Reports page PDF works:** `generateReportPdf()` uses spreads throughout
(`...box.color`, `...box.bg`) — no array-as-argument calls.

**Verified:**
- `setTextColor([...])` throws in jsPDF 4.2.1 (reproduced in Node).
- The spread form `setTextColor(...(net >= 0 ? teal : coral))` works for both
  positive and negative net (reproduced in Node).
- `jspdf@4.2.1` + `jspdf-autotable@5.0.8` generate a valid PDF with the exact
  options used in `pdf.ts` (reproduced in Node).

## Fix

```ts
// before
doc.setTextColor(summary.net >= 0 ? [...teal] : [...coral]);
// after (applied — typed tuple, then spread; the ternary spread alone fails TS
// because a union of tuples isn't spreadable, so resolve to one tuple first)
const netColor: readonly [number, number, number] = summary.net >= 0 ? teal : coral;
doc.setTextColor(...netColor);
```

Resolves the runtime crash AND the existing svelte-check error at `pdf.ts:112`.

## Optional follow-up (does NOT affect the bug)

`svelte-check` also reports TS-only errors in `pdf.ts` — these don't break
runtime because the calls already spread correctly:

- `pdf.ts:268,277` — `doc.setFillColor(...box.bg)` / `doc.setTextColor(...box.color)`
  spread `number[]`; TS wants a tuple. Fix: type the `boxes` color/bg as
  `[number, number, number]` tuples.
- `pdf.ts:368` — `(doc.internal as any).getNumberOfPages()`. Works at runtime,
  but the public `doc.getNumberOfPages()` + `doc.getCurrentPageInfo().pageNumber`
  are the supported API.

Recommend fixing the transactions bug now; the TS cleanups can ride along in the
same commit since they're small and restore type health.

## Files touched

- `src/lib/utils/pdf.ts` (line 112 fix + optional TS cleanup)

## Verification

1. `npm run dev` → `/transactions` → overflow menu → **Export PDF** → a
   `transactions-YYYY-MM-DD.pdf` downloads.
2. Check dev console has no `[Export] PDF generation failed` error.
3. `npm run check` — `pdf.ts` errors gone.
4. Spot-check the PDF: header band, summary box (Income / Expenses / Net
   Balance), table with teal/coral amounts.
