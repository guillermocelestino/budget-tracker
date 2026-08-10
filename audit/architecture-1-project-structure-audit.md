# Architecture-1 — Project Structure Audit

**Repo:** budget-tracker · **Branch:** `feat/project-architecture-restructure` · **Date:** 2026-08-10  
**Status:** READ-ONLY. No files modified, nothing installed, no commits.

---

## 1. Current Tree (relevant `src/` only)

```
src/
├── app.d.ts                    # App-wide types (PageData, Locals)
├── app.html                    # SvelteKit shell
├── auth.ts                     # Auth.js config + helpers (ROOT)
├── hooks.server.ts             # Auth guard + root redirect (ROOT)
├── lib/
│   ├── .DS_Store
│   ├── index.ts                # empty barrel
│   ├── assets/
│   │   └── favicon.svg
│   ├── auth.ts                 # bcrypt hash/verify only (SHARED)
│   ├── components/             # 77 Svelte components (CLIENT)
│   │   ├── ActiveIouList.svelte
│   │   ├── BottomNav.svelte
│   │   ├── Button.svelte
│   │   ├── CashFlowChart.svelte
│   │   ├── CategoryBreakdownWidget.svelte
│   │   ├── CategoryChart.svelte
│   │   ├── CategoryDonutChart.svelte
│   │   ├── CategoryFilterMenu.svelte
│   │   ├── CategoryForm.svelte
│   │   ├── CategoryList.svelte
│   │   ├── CategoryUsageBar.svelte
│   │   ├── ConfettiBurst.svelte
│   │   ├── CountChip.svelte
│   │   ├── DashboardHero.svelte
│   │   ├── DateFilterMenu.svelte
│   │   ├── DateHeaderBand.svelte
│   │   ├── DeletePaymentConfirmModal.svelte
│   │   ├── EditPaymentModal.svelte
│   │   ├── EmptyState.svelte
│   │   ├── ExportDropdown.svelte
│   │   ├── FilterFooter.svelte
│   │   ├── FiltersSheet.svelte
│   │   ├── ForecastBanner.svelte
│   │   ├── HeroBalanceWidget.svelte
│   │   ├── ImportDropZone.svelte
│   │   ├── ImportMapping.svelte
│   │   ├── ImportPreview.svelte
│   │   ├── ImportWizard.svelte
│   │   ├── KpiRail.svelte
│   │   ├── LendingBalanceHeader.svelte
│   │   ├── LendingFilters.svelte
│   │   ├── LendingForm.svelte
│   │   ├── LendingImport.svelte
│   │   ├── LendingSummaryCards.svelte
│   │   ├── ListToolbar.svelte
│   │   ├── LiveImpactPreview.svelte
│   │   ├── MobileSummaryRail.svelte
│   │   ├── ModalDialog.svelte
│   │   ├── MonthlyChart.svelte
│   │   ├── MonthlyTrendChart.svelte
│   │   ├── MonthPicker.svelte
│   │   ├── MoreMenu.svelte
│   │   ├── NetWorthHero.svelte
│   │   ├── OnboardingWalkthrough.svelte
│   │   ├── OverflowMenu.svelte
│   │   ├── PageBackground.svelte
│   │   ├── PageHeader.svelte
│   │   ├── PaymentHistoryPanel.svelte
│   │   ├── RecordPaymentModal.svelte
│   │   ├── RecurringForm.svelte
│   │   ├── RowActionsMenu.svelte
│   │   ├── RowHoverActions.svelte
│   │   ├── SafeToSpendWidget.svelte
│   │   ├── SearchFilterPill.svelte
│   │   ├── SearchModal.svelte
│   │   ├── SettingsForm.svelte
│   │   ├── SettingsSection.svelte
│   │   ├── SlideOver.svelte
│   │   ├── SpeedDial.svelte
│   │   ├── SummaryCard.svelte
│   │   ├── SummaryCards.svelte
│   │   ├── TransactionFilterToolbar.svelte
│   │   ├── TransactionForm.svelte
│   │   ├── TransactionList.svelte
│   │   ├── TransactionSummary.svelte
│   │   ├── ViewToggle.svelte
│   │   └── YearOverYearCard.svelte
│   ├── database/               # 7 files (SERVER — raw SQL + Drizzle)
│   │   ├── index.ts            # Pool + lazy init + NUMERIC parser
│   │   ├── loadEnv.ts          # dev-only .env wiring
│   │   ├── init.ts             # boot-time schema ensure + seeds
│   │   ├── query.ts            # queryOne/queryMany/execute/withTransaction
│   │   ├── drizzle.ts          # Drizzle client wrapper (Neon-only)
│   │   ├── schema.ts           # Drizzle schema (source of truth for migrations)
│   │   └── migrations/         # numbered .sql migrations
│   ├── server/                 # 7 files (SERVER — services)
│   │   ├── transactions.ts
│   │   ├── categories.ts
│   │   ├── lendingPayments.ts
│   │   ├── recurringService.ts
│   │   ├── recurringScheduler.ts
│   │   ├── networth.ts
│   │   ├── recordLendingTransaction.ts
│   │   ├── transactionImport.ts
│   │   └── lendingImport.ts
│   ├── stores/                 # 2 files (CLIENT — Svelte 5 runes)
│   │   ├── preferences.svelte.ts
│   │   └── toast.svelte.ts
│   ├── types.ts                # 1 file (SHARED — all domain types)
│   └── utils/                  # 13 files (mixed — see classification below)
│       ├── categoryColors.ts
│       ├── chart.ts            # Chart.js registration (CLIENT)
│       ├── csv.ts              # CSV serialization + download (SHARED+CLIENT)
│       ├── fileImport.ts       # CSV/Excel parser (SHARED)
│       ├── format.ts           # currency/date formatting (SHARED — uses store)
│       ├── importValidation.ts # import validation schema (SHARED)
│       ├── lendingImport.ts    # lending import schema (SHARED)
│       ├── loginValidation.ts  # login input + credential verify (SHARED)
│       ├── pdf.ts              # PDF generation (CLIENT — jspdf browser-only)
│       └── recurring.ts        # recurrence math (SHARED)
│       └── ... (spec files excluded)
├── routes/
│   ├── +layout.svelte          # root layout (CLIENT)
│   ├── +layout.server.ts       # exposes locals.user (SERVER route)
│   ├── +page.svelte            # root → 302 dashboard (CLIENT)
│   ├── auth/                   # (none — Auth.js handles /auth/*)
│   ├── api/                    # 12 API endpoints (ROUTE)
│   │   ├── categories/[id]/+server.ts
│   │   ├── categories/+server.ts
│   │   ├── lendings/[id]/+server.ts
│   │   ├── lendings/[id]/payments/+server.ts
│   │   ├── lendings/+server.ts
│   │   ├── recurring/[id]/+server.ts
│   │   ├── recurring/+server.ts
│   │   ├── reports/by-category/+server.ts
│   │   ├── reports/export/+server.ts
│   │   ├── reports/monthly/+server.ts
│   │   ├── search/+server.ts
│   │   ├── transactions/[id]/+server.ts
│   │   ├── transactions/+server.ts
│   │   └── transactions/export/+server.ts
│   ├── borrowed/               # ROUTE (lending mirror)
│   ├── categories/             # ROUTE
│   ├── dashboard/              # ROUTE
│   ├── lending/                # ROUTE
│   ├── login/                  # ROUTE (+page.server.ts for form action)
│   ├── logout/                 # ROUTE (+server.ts)
│   ├── net-worth/              # ROUTE
│   ├── recurring/              # ROUTE (3 sub-routes)
│   ├── reports/                # ROUTE
│   ├── settings/               # ROUTE (no +page.server.ts)
│   └── transactions/           # ROUTE (3 sub-routes)
├── pwa-types.d.ts
└── styles/
    └── variables.css           # design tokens (SHARED CSS)
```

---

## 2. Target Tree (from brief)

```
src/
├── lib/
│   ├── client/
│   │   ├── components/
│   │   ├── stores/
│   │   └── utils/
│   ├── server/
│   │   ├── db/
│   │   ├── services/
│   │   ├── auth/
│   │   └── utils/
│   └── shared/
│       ├── types/
│       ├── constants/
│       └── utils/
├── routes/
│   ├── api/
│   ├── dashboard/
│   ├── transactions/
│   ├── categories/
│   ├── budgets/
│   ├── lending/
│   ├── reports/
│   └── settings/
├── auth.ts
└── hooks.server.ts
```

---

## 3. Migration Table — All 136 Relevant Files

| Current File | Classification | Proposed Target | Reason | Risk |
|--------------|----------------|-----------------|--------|------|
| **ROOT** | | | | |
| `src/auth.ts` | ROOT | `src/auth.ts` | Auth.js config + helpers — must stay at root | **HIGH** — referenced by `hooks.server.ts`, login/logout routes, server services. Moving breaks all paths. |
| `src/hooks.server.ts` | ROOT | `src/hooks.server.ts` | SvelteKit handle chain — must stay at root | **HIGH** — SvelteKit convention; `sequence` export expected here. |
| `src/app.d.ts` | ROOT | `src/app.d.ts` | App-wide types (`App.Locals`, `App.PageData`) — must stay at root | **HIGH** — referenced by every `+page.server.ts` and `+server.ts`. |
| `src/app.html` | ROOT | `src/app.html` | SvelteKit shell — must stay at root | **MEDIUM** — standard location, safe to move only with config changes. |
| `src/pwa-types.d.ts` | ROOT | `src/pwa-types.d.ts` | PWA types for SW — must stay at root | **LOW** — only consumed by Vite PWA plugin. |
| `src/styles/variables.css` | ROOT (shared CSS) | `src/lib/shared/constants/variables.css` or keep at root | Global design tokens imported by `+layout.svelte` | **MEDIUM** — `@import` path in layout; could move to shared if import updated. |
| **LIB — DATABASE (SERVER)** | | | | |
| `src/lib/database/index.ts` | SERVER | `src/lib/server/db/index.ts` | Pool + lazy init + NUMERIC parser — Postgres-only runtime | **MEDIUM** — imported by `query.ts`, `drizzle.ts`, `init.ts`, `loadEnv.ts`, scripts. |
| `src/lib/database/loadEnv.ts` | SERVER | `src/lib/server/db/loadEnv.ts` | Dev-only env wiring — server-only | **LOW** — only imported by `index.ts`. |
| `src/lib/database/init.ts` | SERVER | `src/lib/server/db/init.ts` | Boot-time schema ensure + seeds — runs on server | **MEDIUM** — imported by `index.ts` and seed scripts. |
| `src/lib/database/query.ts` | SERVER | `src/lib/server/db/query.ts` | Cross-DB query helpers — used by auth, legacy, scripts | **MEDIUM** — imported by `src/auth.ts`, server services, scripts, unit tests. |
| `src/lib/database/drizzle.ts` | SERVER | `src/lib/server/db/drizzle.ts` | Drizzle client wrapper — Neon-only | **LOW** — imported by 7 server service files. |
| `src/lib/database/schema.ts` | SERVER | `src/lib/server/db/schema.ts` | Drizzle schema — source of truth for `drizzle-kit generate` | **LOW** — imported by `drizzle.ts` and unit tests only. |
| `src/lib/database/migrations/` | SERVER | `src/lib/server/db/migrations/` | Numbered SQL migrations — `drizzle-kit migrate` target | **LOW** — only used by `drizzle-kit` CLI. |
| **LIB — SERVER SERVICES** | | | | |
| `src/lib/server/transactions.ts` | SERVER | `src/lib/server/services/transactions.ts` | Transaction CRUD + list + balance | **LOW** — only imported by server routes + server services. |
| `src/lib/server/categories.ts` | SERVER | `src/lib/server/services/categories.ts` | Category CRUD + budget | **LOW** — only imported by server routes + server services. |
| `src/lib/server/lendingPayments.ts` | SERVER | `src/lib/server/services/lendingPayments.ts` | Lending payments ledger — source of truth | **LOW** — only imported by server routes + server services. |
| `src/lib/server/recurringService.ts` | SERVER | `src/lib/server/services/recurringService.ts` | Recurring CRUD + validation | **LOW** — only imported by server routes + scheduler. |
| `src/lib/server/recurringScheduler.ts` | SERVER | `src/lib/server/services/recurringScheduler.ts` | Recurring processing + generation | **LOW** — imported by dashboard route + duplicate action. |
| `src/lib/server/networth.ts` | SERVER | `src/lib/server/services/networth.ts` | Net worth computation | **LOW** — imported by net-worth route + dashboard. |
| `src/lib/server/recordLendingTransaction.ts` | SERVER | `src/lib/server/services/recordLendingTransaction.ts` | Transaction creation on lending events | **LOW** — imported by `lendingPayments.ts` + import. |
| `src/lib/server/transactionImport.ts` | SERVER | `src/lib/server/services/transactionImport.ts` | CSV import (server authoritative) | **LOW** — imported by transactions page server + API. |
| `src/lib/server/lendingImport.ts` | SERVER | `src/lib/server/services/lendingImport.ts` | Lending CSV import | **LOW** — imported by lending/borrowed page server. |
| **LIB — STORES (CLIENT)** | | | | |
| `src/lib/stores/preferences.svelte.ts` | CLIENT | `src/lib/client/stores/preferences.svelte.ts` | localStorage-backed, DOM access (`document`, `window`) | **MEDIUM** — imported by 22 components + `format.ts`. |
| `src/lib/stores/toast.svelte.ts` | CLIENT | `src/lib/client/stores/toast.svelte.ts` | Svelte 5 runes, no DOM | **LOW** — imported by 11 components. |
| **LIB — TYPES (SHARED)** | | | | |
| `src/lib/types.ts` | SHARED | `src/lib/shared/types/index.ts` | All domain types — imported by client + server | **MEDIUM** — 136 imports across client, server, routes. Path updates needed. |
| **LIB — UTILS (MIXED — must split)** | | | | |
| `src/lib/utils/chart.ts` | CLIENT | `src/lib/client/utils/chart.ts` | Chart.js registration — `window` side effects, browser-only | **LOW** — imported by 6 chart components. |
| `src/lib/utils/csv.ts` | SHARED | `src/lib/shared/utils/csv.ts` | `csvEscape`, `transactionsToCSV`, `lendingsToCSV` — pure; `downloadCsv` is CLIENT | **MEDIUM** — `downloadCsv` used by 3 client components; serialization used by 2 server routes. |
| `src/lib/utils/fileImport.ts` | SHARED | `src/lib/shared/utils/fileImport.ts` | `parseImportFile` — universal CSV/Excel parser | **LOW** — imported by 2 server imports + 3 client components (preview). |
| `src/lib/utils/format.ts` | SHARED (with caveat) | `src/lib/shared/utils/format.ts` | Currency/date formatting — **uses `prefs` store (CLIENT)** | **HIGH** — imported by 42 components + 5 server routes! Store dependency must be removed or abstracted. |
| `src/lib/utils/importValidation.ts` | SHARED | `src/lib/shared/utils/importValidation.ts` | Import schema + validation — pure logic | **LOW** — imported by 2 server imports + client preview. |
| `src/lib/utils/lendingImport.ts` | SHARED | `src/lib/shared/utils/lendingImport.ts` | Lending import schema — pure logic | **LOW** — imported by 1 server import + client preview. |
| `src/lib/utils/loginValidation.ts` | SHARED | `src/lib/shared/utils/loginValidation.ts` | Input validation + credential verify — uses `$lib/auth` (SHARED) | **LOW** — imported by `src/auth.ts` + login route. |
| `src/lib/utils/pdf.ts` | CLIENT | `src/lib/client/utils/pdf.ts` | jspdf + autotable — browser-only (dynamic import) | **LOW** — imported by 4 client components. |
| `src/lib/utils/recurring.ts` | SHARED | `src/lib/shared/utils/recurring.ts` | Recurrence math — pure, no deps | **LOW** — imported by 2 server services + 1 client component. |
| `src/lib/utils/categoryColors.ts` | SHARED | `src/lib/shared/utils/categoryColors.ts` | Category hue system — pure, no deps | **LOW** — imported by 7 components + 1 server route. |
| **LIB — COMPONENTS (CLIENT — 77 files)** | | | | |
| `src/lib/components/*.svelte` (77 files) | CLIENT | `src/lib/client/components/*.svelte` | All Svelte 5 components, browser-only APIs | **MEDIUM** — 77 files, internal cross-imports, path updates needed. |
| **ROUTES (ROUTE)** | | | | |
| `src/routes/+layout.svelte` | ROUTE (CLIENT) | `src/routes/+layout.svelte` | Root layout — stays under routes | **NONE** |
| `src/routes/+layout.server.ts` | ROUTE (SERVER) | `src/routes/+layout.server.ts` | Exposes `locals.user` — stays under routes | **NONE** |
| `src/routes/+page.svelte` | ROUTE (CLIENT) | `src/routes/+page.svelte` | Root redirect — stays under routes | **NONE** |
| `src/routes/api/**/*.ts` (12 files) | ROUTE (SERVER) | `src/routes/api/**/*.ts` | REST endpoints — stay under `routes/api` | **NONE** |
| `src/routes/borrowed/+page.svelte` | ROUTE (CLIENT) | `src/routes/borrowed/+page.svelte` | — | **NONE** |
| `src/routes/borrowed/+page.server.ts` | ROUTE (SERVER) | `src/routes/borrowed/+page.server.ts` | — | **NONE** |
| `src/routes/categories/+page.svelte` | ROUTE (CLIENT) | `src/routes/categories/+page.svelte` | — | **NONE** |
| `src/routes/categories/+page.server.ts` | ROUTE (SERVER) | `src/routes/categories/+page.server.ts` | — | **NONE** |
| `src/routes/dashboard/+page.svelte` | ROUTE (CLIENT) | `src/routes/dashboard/+page.svelte` | — | **NONE** |
| `src/routes/dashboard/+page.server.ts` | ROUTE (SERVER) | `src/routes/dashboard/+page.server.ts` | — | **NONE** |
| `src/routes/lending/+page.svelte` | ROUTE (CLIENT) | `src/routes/lending/+page.svelte` | — | **NONE** |
| `src/routes/lending/+page.server.ts` | ROUTE (SERVER) | `src/routes/lending/+page.server.ts` | — | **NONE** |
| `src/routes/login/+page.svelte` | ROUTE (CLIENT) | `src/routes/login/+page.svelte` | — | **NONE** |
| `src/routes/login/+page.server.ts` | ROUTE (SERVER) | `src/routes/login/+page.server.ts` | Form action — stays | **NONE** |
| `src/routes/logout/+server.ts` | ROUTE (SERVER) | `src/routes/logout/+server.ts` | — | **NONE** |
| `src/routes/net-worth/+page.svelte` | ROUTE (CLIENT) | `src/routes/net-worth/+page.svelte` | — | **NONE** |
| `src/routes/net-worth/+page.server.ts` | ROUTE (SERVER) | `src/routes/net-worth/+page.server.ts` | — | **NONE** |
| `src/routes/recurring/+page.svelte` | ROUTE (CLIENT) | `src/routes/recurring/+page.svelte` | — | **NONE** |
| `src/routes/recurring/+page.server.ts` | ROUTE (SERVER) | `src/routes/recurring/+page.server.ts` | — | **NONE** |
| `src/routes/recurring/new/+page.svelte` | ROUTE (CLIENT) | `src/routes/recurring/new/+page.svelte` | — | **NONE** |
| `src/routes/recurring/new/+page.server.ts` | ROUTE (SERVER) | `src/routes/recurring/new/+page.server.ts` | — | **NONE** |
| `src/routes/recurring/[id]/+page.svelte` | ROUTE (CLIENT) | `src/routes/recurring/[id]/+page.svelte` | — | **NONE** |
| `src/routes/recurring/[id]/+page.server.ts` | ROUTE (SERVER) | `src/routes/recurring/[id]/+page.server.ts` | — | **NONE** |
| `src/routes/reports/+page.svelte` | ROUTE (CLIENT) | `src/routes/reports/+page.svelte` | — | **NONE** |
| `src/routes/reports/+page.server.ts` | ROUTE (SERVER) | `src/routes/reports/+page.server.ts` | — | **NONE** |
| `src/routes/settings/+page.svelte` | ROUTE (CLIENT) | `src/routes/settings/+page.svelte` | — | **NONE** |
| `src/routes/transactions/+page.svelte` | ROUTE (CLIENT) | `src/routes/transactions/+page.svelte` | — | **NONE** |
| `src/routes/transactions/+page.server.ts` | ROUTE (SERVER) | `src/routes/transactions/+page.server.ts` | — | **NONE** |
| `src/routes/transactions/new/+page.svelte` | ROUTE (CLIENT) | `src/routes/transactions/new/+page.svelte` | — | **NONE** |
| `src/routes/transactions/new/+page.server.ts` | ROUTE (SERVER) | `src/routes/transactions/new/+page.server.ts` | — | **NONE** |
| `src/routes/transactions/[id]/edit/+page.svelte` | ROUTE (CLIENT) | `src/routes/transactions/[id]/edit/+page.svelte` | — | **NONE** |
| `src/routes/transactions/[id]/edit/+page.server.ts` | ROUTE (SERVER) | `src/routes/transactions/[id]/edit/+page.server.ts` | — | **NONE** |

---

## 4. Already-Correct Files (Should Remain Untouched)

| File/Directory | Reason |
|----------------|--------|
| `src/auth.ts` | Root-level Auth.js config — SvelteKit convention, referenced by `hooks.server.ts` |
| `src/hooks.server.ts` | Root-level handle chain — SvelteKit convention |
| `src/app.d.ts` | App-wide types — must be at root for `App.Locals`/`App.PageData` |
| `src/app.html` | SvelteKit shell |
| `src/pwa-types.d.ts` | PWA plugin types |
| `src/routes/**` (all 42 route files) | SvelteKit route boundaries — already under `src/routes/` per target |
| `src/styles/variables.css` | Currently at root; could move to `shared/constants` but works at root |

---

## 5. Mixed-Responsibility Files (Require Refactoring Before Moving)

### **HIGH RISK — `src/lib/utils/format.ts` (SHARED label but CLIENT dependency)**
- **Problem:** Imports `prefs` store from `$lib/stores/preferences.svelte.ts` (CLIENT — uses `document`, `window`, `localStorage`).
- **Impact:** 47 importers (42 client components + 5 server routes: `borrowed`, `dashboard`, `lending`, `categories API`, `reports`).
- **Cannot move to `shared/` until:** Store dependency removed or abstracted via a `getPreferences()` function that server routes can mock/override.
- **Fix options:**
  1. Split into `format.shared.ts` (pure functions taking `currency`/`dateFormat` params) + `format.client.ts` (store-backed convenience).
  2. Pass preferences explicitly from callers (server routes already have `locals.user`, could fetch prefs if table existed; for now use defaults).

### **MEDIUM RISK — `src/lib/utils/csv.ts` (SHARED + CLIENT)**
- **Problem:** `downloadCsv()` uses `document.createElement('a')` + `URL.createObjectURL` (browser-only). Pure serialization (`csvEscape`, `transactionsToCSV`, `lendingsToCSV`) is SHARED.
- **Impact:** 5 importers — 3 client components use `downloadCsv`; 2 server routes (`/api/transactions/export`, `/api/reports/export`) use serialization only.
- **Fix:** Split `downloadCsv` into `csv.client.ts`; keep serialization in `shared/utils/csv.ts`.

### **MEDIUM RISK — `src/lib/auth.ts` (labeled SHARED, but server-only consumers)**
- **Problem:** Exports `hashPassword`/`verifyPassword` (bcrypt). Only consumed by:
  - `src/auth.ts` (ROOT — server)
  - `src/lib/database/init.ts` (SERVER — seed)
  - `scripts/seed-demo.*` (server scripts)
  - `tests/unit-test/loginValidation.test.ts` (unit test)
  - `src/lib/utils/loginValidation.ts` (SHARED — but `verifyUserCredentials` calls `verifyPassword`)
- **Actually safe:** bcrypt works in both Node and browser (via WASM fallback), but only used server-side today. Can stay in `shared/utils/auth.ts` or `server/auth/`.

---

## 6. Import/Dependency Risks

### **Client → Server Imports (FORBIDDEN — must not exist)**
| Importer (Client) | Imported (Server) | Status |
|-------------------|-------------------|--------|
| None found | — | ✅ Clean |

### **Shared → Server Imports (FORBIDDEN — must not exist)**
| Importer (Shared) | Imported (Server) | Status |
|-------------------|-------------------|--------|
| `src/lib/utils/format.ts` (uses store) | — | ⚠️ Store is CLIENT |
| `src/lib/utils/loginValidation.ts` | `$lib/auth` (bcrypt) | ✅ bcrypt is universal |

### **Server → Browser-Only Imports (FORBIDDEN — must not exist)**
| Importer (Server) | Imported (Browser) | Status |
|-------------------|-------------------|--------|
| `src/routes/borrowed/+page.server.ts` | `$lib/utils/format` (via store) | ⚠️ **RISK** |
| `src/routes/dashboard/+page.server.ts` | `$lib/utils/format` (via store) | ⚠️ **RISK** |
| `src/routes/lending/+page.server.ts` | `$lib/utils/format` (via store) | ⚠️ **RISK** |
| `src/routes/categories/+server.ts` | `$lib/utils/format` (via store) | ⚠️ **RISK** |
| `src/routes/reports/+page.server.ts` | `$lib/utils/format` (via store) | ⚠️ **RISK** |

### **Circular Dependencies**
- None detected in current graph.

### **`$lib/...` Imports Requiring Updates After Move**
| Import Pattern | Files Affected | New Path |
|----------------|----------------|----------|
| `$lib/types` | 136 imports | `$lib/shared/types` |
| `$lib/stores/preferences.svelte` | 22 components | `$lib/client/stores/preferences.svelte` |
| `$lib/stores/toast.svelte` | 11 components | `$lib/client/stores/toast.svelte` |
| `$lib/components/*` | 200+ cross-imports | `$lib/client/components/*` |
| `$lib/utils/format` | 47 imports | `$lib/shared/utils/format` (after split) |
| `$lib/utils/csv` | 5 imports | `$lib/shared/utils/csv` / `$lib/client/utils/csv` |
| `$lib/utils/chart` | 6 components | `$lib/client/utils/chart` |
| `$lib/utils/pdf` | 4 components | `$lib/client/utils/pdf` |
| `$lib/utils/recurring` | 4 imports | `$lib/shared/utils/recurring` |
| `$lib/utils/categoryColors` | 8 imports | `$lib/shared/utils/categoryColors` |
| `$lib/utils/importValidation` | 4 imports | `$lib/shared/utils/importValidation` |
| `$lib/utils/lendingImport` | 2 imports | `$lib/shared/utils/lendingImport` |
| `$lib/utils/loginValidation` | 2 imports | `$lib/shared/utils/loginValidation` |
| `$lib/utils/fileImport` | 5 imports | `$lib/shared/utils/fileImport` |
| `$lib/auth` | 3 imports | `$lib/shared/utils/auth` or `$lib/server/auth/` |
| `$lib/database/query` | 12 imports | `$lib/server/db/query` |
| `$lib/database/drizzle` | 7 imports | `$lib/server/db/drizzle` |
| `$lib/database/schema` | 2 imports | `$lib/server/db/schema` |
| `$lib/server/*` | 30+ imports | `$lib/server/services/*` |

### **`$env/*` Usage (SERVER ONLY — correct)**
- `src/auth.ts`: `$env/dynamic/private` (Auth.js reads `AUTH_SECRET`)
- `src/lib/database/loadEnv.ts`: reads `.env` directly (dev only)

### **`$app/*` Usage (ROUTE/CLIENT ONLY — correct)**
- Components use: `$app/forms` (`enhance`), `$app/navigation` (`goto`, `invalidateAll`), `$app/stores` (`page`, `navigating`), `$app/environment` (`browser`, `dev`)
- All in `.svelte` files or `+page.server.ts` — correct boundary.

### **Server-Only Modules Reachable by Browser Code**
| Module | Current Exposure | Risk |
|--------|------------------|------|
| `$lib/server/*` | Not imported by any `.svelte` or client code | ✅ Safe |
| `$lib/database/*` | Only by `src/auth.ts` (ROOT), server services, scripts, tests | ✅ Safe |
| `$lib/utils/format` (via store) | 5 server routes import it → pulls in CLIENT store | ⚠️ **Server bundle pollution** |

---

## 7. Route Organization

### **Already Matching Target (`src/routes/` structure preserved)**
All 42 route files remain under `src/routes/` — target architecture keeps routes there.

### **Routes Requiring Reorganization (per target subdirectories)**
| Current | Target | Note |
|---------|--------|------|
| `src/routes/borrowed/` | `src/routes/lending/borrowed/` or keep | Target has `lending/` and `budgets/` — borrowed is lending mirror |
| `src/routes/categories/` | `src/routes/categories/` | ✅ Matches |
| `src/routes/dashboard/` | `src/routes/dashboard/` | ✅ Matches |
| `src/routes/lending/` | `src/routes/lending/` | ✅ Matches |
| `src/routes/login/` + `logout/` | `src/routes/auth/` (Auth.js handles `/auth/*`) | Login/logout are app routes, not Auth.js routes — keep as-is |
| `src/routes/net-worth/` | `src/routes/reports/net-worth/` or keep | Target has `reports/` — net-worth is a report |
| `src/routes/recurring/` | `src/routes/recurring/` | ✅ Matches |
| `src/routes/reports/` | `src/routes/reports/` | ✅ Matches |
| `src/routes/settings/` | `src/routes/settings/` | ✅ Matches |
| `src/routes/transactions/` | `src/routes/transactions/` | ✅ Matches |

### **Route Files That Should NOT Move**
All `+page.svelte`, `+page.server.ts`, `+server.ts`, `+layout.svelte`, `+layout.server.ts` — SvelteKit route boundaries.

### **API Routes**
All 12 under `src/routes/api/` — target says `src/routes/api/` stays. **Do not introduce `/api/v2`.**

---

## 8. Obsolete / Safe-to-Remove Later

| Path | Reason | Do Not Delete In This Phase |
|------|--------|----------------------------|
| `data/budget.db*` | SQLite dev DB — Neon/Postgres is production runtime | Phase 2+ |
| `src/lib/database/index.ts` references to `better-sqlite3` | Commented/guarded — only `optionalDependencies` in package.json | Phase 2+ |
| `src/lib/database/loadEnv.ts` dev-only branch | Wires `LOCAL_DEV_DATABASE_URL` → `DATABASE_URL` for `npm run dev` | Keep — needed for local dev |
| `src/lib/database/init.ts` boot-time schema ensure | Redundant with `drizzle-kit migrate` — kept for Vercel serverless safety | Keep until migration path proven |
| `src/lib/index.ts` | Empty barrel file | Can delete anytime |
| `scripts/migrate-sqlite-to-neon.ts` | One-time migration script | Archive after verification |

---

## 9. Recommended Migration Phases

### **Phase 2 — Server Boundary (Foundation)**
> Create `src/lib/server/db/`, `src/lib/server/services/`, `src/lib/server/auth/`  
> Move: `database/*` → `server/db/`; `server/*` → `server/services/`; `auth.ts` (bcrypt) → `server/auth/` or `shared/utils/auth.ts`  
> Update imports in: `src/auth.ts` (ROOT), server routes, scripts, unit tests  
> **Verifiable:** `npm run check`, `npm run test:unit` pass

### **Phase 3 — Client Boundary**
> Create `src/lib/client/components/`, `src/lib/client/stores/`, `src/lib/client/utils/`  
> Move: `components/*` → `client/components/`; `stores/*` → `client/stores/`; `chart.ts`, `pdf.ts` → `client/utils/`  
> Update all 77 component cross-imports + 33 store/utility imports  
> **Verifiable:** `npm run check`, dev server loads, no console errors

### **Phase 4 — Shared Boundary**
> Create `src/lib/shared/types/`, `src/lib/shared/constants/`, `src/lib/shared/utils/`  
> Move: `types.ts` → `shared/types/index.ts`; `variables.css` → `shared/constants/`; `csv.ts` (split), `fileImport.ts`, `importValidation.ts`, `lendingImport.ts`, `loginValidation.ts`, `recurring.ts`, `categoryColors.ts` → `shared/utils/`  
> **Critical:** Split `format.ts` into `shared/utils/format.ts` (pure, params) + `client/utils/format.ts` (store-backed) BEFORE moving  
> Update 136+ type imports, 47 format imports, etc.  
> **Verifiable:** `npm run check`, all routes render, server routes work

### **Phase 5 — Import Cleanup & Verification**
> - Remove `src/lib/index.ts` (empty)
> - Update `tsconfig.json` path aliases if any
> - Search for stale `$lib/database`, `$lib/server`, `$lib/utils` imports
> - Run full test suite: `npm run check && npm run lint && npm run test:unit && npm run test:e2e`

### **Phase 6 — Final Verification & Route Cleanup**
> - Verify no `src/lib/` flat files remain (except allowed root)
> - Confirm `src/routes/` structure matches target subdirectories
> - Archive obsolete scripts (`migrate-sqlite-to-neon.ts`)
> - Document new architecture in `CLAUDE.md`

---

## 10. Files Requiring Manual Decision

| File | Decision Needed |
|------|-----------------|
| `src/styles/variables.css` | Move to `shared/constants/variables.css` (update `@import` in `+layout.svelte`) or keep at root? |
| `src/lib/auth.ts` (bcrypt) | Place in `shared/utils/auth.ts` (universal) or `server/auth/utils.ts` (server-only)? Currently only used server-side. |
| `src/routes/borrowed/` | Keep as sibling to `lending/` or nest under `lending/borrowed/`? |
| `src/routes/net-worth/` | Keep as top-level or move under `reports/`? |
| `src/routes/login/` + `logout/` | Target has `auth/` at route level — but these are app routes using Auth.js, not Auth.js routes. Keep as-is? |

---

## 11. Summary

- **Files inspected:** 136 relevant source files (excludes specs, `.DS_Store`, node_modules)
- **Proposed migrations:** 96 files to move (7 db, 10 server services, 2 stores, 1 types, 11 utils, 77 components, 0 routes)
- **Already correct:** 48 files (42 routes + 6 root)
- **Risky/mixed files:** 3 (`format.ts` — HIGH, `csv.ts` — MEDIUM, `auth.ts` bcrypt — MEDIUM)
- **Import updates needed:** ~500+ import statements across the codebase
- **Recommended order:** Server → Client → Shared → Cleanup → Verify
- **Blockers:** `format.ts` store dependency MUST be resolved before Phase 4 (Shared)

---

**End of Audit.** Ready for Architecture-2 (Server Boundary) when approved.