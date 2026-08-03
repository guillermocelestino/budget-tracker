# Add Export PDF to Lending & Borrowed pages

## Goal

Mirror the Transactions-page **Export PDF** on the Lending and Borrowed pages,
reusing the existing Flip7 PDF architecture and styling — no new PDF stack, no
copy-pasted generators.

- Lending PDF: summary = Total Lent, Total Recovered, Outstanding Balance,
  Number of Loans; table = Borrower, Amount Lent, Recovered, Outstanding,
  Due Date, Status, Notes.
- Borrowed PDF: summary = Total Borrowed, Total Repaid, Remaining Balance,
  Number of Loans; table = Lender, Amount Borrowed, Repaid, Remaining Balance,
  Due Date, Status, Notes.
- Export **the currently filtered list only** (status tab + search → the pages'
  existing `showLendings` derived).
- Filenames: `lending-YYYY-MM-DD.pdf`, `borrowed-YYYY-MM-DD.pdf`.

## Reuse (no new components)

- `OverflowMenu` already renders an **Export PDF** option when passed
  `onExportPdf` — both pages already mount it in desktop + mobile headers.
- `formatPlainAmount` / `formatDateShort` / `formatCurrency` already exist in
  `src/lib/utils/format.ts`.

## Refactor: shared PDF building blocks (`src/lib/utils/pdf.ts`)

Extract the duplicated Flip7 scaffolding into small helpers used by ALL four
generators (transactions, report, lending, borrowed) so nothing is duplicated:

1. `COLORS` — shared palette (black, teal, gold, coral, ink, muted, borderC, band).
2. `createPdfDocument()` — loads jsPDF + jspdf-autotable, returns A4 doc + dims.
3. `drawHeaderBand(doc, pw, m)` — teal band, "Trackr" wordmark, gold rule.
4. `pageFooter(doc, pw, ph, m, label)` — footer rule + "Page X of Y".
5. `drawSummaryStrip(doc, pw, m, y, rows)` — full-width label/value strip
   (reproduces the transactions summary exactly; 4 rows for lending/borrowed).
6. `renderPdfTable(doc, autoTable, pw, ph, m, opts)` — the standard plain-theme
   table (header/body styles, zebra rows, footer) parameterized by head/body/
   columnStyles/didParseCell/footerLabel.

`generateTransactionPdf` and `generateReportPdf` are refactored to use these
helpers with **identical drawing calls**, so their output is unchanged
(transactions keeps black amounts; report keeps its teal/coral amounts).

New generators:

- `generateLendingPdf(lendings)` / `generateBorrowedPdf(lendings)` — one shared
  core parameterized by `direction: 'lent' | 'borrowed'`; computes the summary
  from the passed (filtered) records: total = Σ amount, recovered/repaid =
  Σ amount where `status === 'paid'`, outstanding/remaining = total − recovered,
  count = records.length. Amount columns rendered in black (consistent with the
  transactions PDF). Per-row: paid → Recovered=amount / Outstanding=0; active →
  Recovered=0 / Outstanding=amount.

## Pages (`src/routes/lending/+page.svelte`, `src/routes/borrowed/+page.svelte`)

- Import the new generator, add `handleExportPdf()`:
  guard empty `showLendings` → toast; else `doc.save('lending|borrowed-…pdf')`.
- Pass `onExportPdf={handleExportPdf}` to both `<OverflowMenu>` instances
  (desktop + mobile).

## Verification

1. `npm run check` — no new errors (13 pre-existing unrelated ones remain).
2. Manual: Lending → ⋯ → Export PDF → `lending-<date>.pdf` with Flip7 header,
   full-width summary strip, table. Same for Borrowed.
3. Cross-check filter/search: changing the status tab or search term changes the
   exported records (and summary) accordingly.
