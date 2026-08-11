# Fix Plan — Checkpoint 2 defects (lendingPayments)

Status: **pending approval** — no code changed yet.
Scope: `src/lib/server/lendingPayments.ts` only (Drizzle + SQLite branches of two functions).
Constraints honored: no schema change, no migrations, no `query.ts` removal, no SQLite removal,
no unrelated refactors, preserve API/output contracts.

---

## 1. Root cause — Bug A (recalcStatusCache / deletePayment)

**Affected:** `recalcStatusCache` (Drizzle branch, line 307) and `deletePayment` (Drizzle branch, line 722).

Both compute the resolved amount with a raw `sql<>` template that interpolates a **column object**
inside a correlated subquery:

```ts
resolved: sql<string>`COALESCE((SELECT SUM(p.amount) FROM ${lendingPayments} p WHERE p.lending_id = ${lendings.id} AND ...), 0)`
```

Drizzle renders `${lendings.id}` inside a raw `sql` template as the **unqualified column name `"id"`**.
Captured generated SQL from the real-Neon probe:

```sql
... WHERE p.lending_id = "id" ...   -- NOT "lendings"."id"
```

Postgres binds the unqualified `"id"` to the **innermost scope** — `"lending_payments" p.id`, the
payment row's own id — so the subquery stops correlating to the outer `lendings` row. The probe showed
the Drizzle query returning `resolved = 10800` (leaking across unrelated payment rows where
`lending_id = id`) instead of the correct `400`; the raw-equivalent SQL (`p.lending_id = l.id`) returns
`400`. Result: `1000 − 10800 ≤ 0` → cached `lendings.status` wrongly set to `paid` after a loan reopens.

The **working** sibling queries (`recordPayment` line 392, `updatePayment` line 590) use a **bound
parameter** — `p.lending_id = ${lendingId}` / `${payment.lending_id}` — which renders `p.lending_id = $n`
and is correct. Bug A is isolated to exactly these two raw-template column interpolations
(grep: only lines 307 and 722 in the server modules use `${lendings.id}` in a `sql` template).

## 2. Proposed fix A

Replace the column interpolation with the already-known lending id — the exact pattern proven by
`recordPayment`/`updatePayment`:

- `recalcStatusCache`: `p.lending_id = ${lendings.id}` → `p.lending_id = ${lendingId}` (param `lendingId`).
- `deletePayment`:   `p.lending_id = ${lendings.id}` → `p.lending_id = ${payment.lending_id}` (fetched above in the same tx).

Generated SQL becomes correct and references the same lending the outer `WHERE "lendings"."id" = $n`
selects:

```sql
... COALESCE((SELECT SUM(p.amount) FROM "lending_payments" p
              WHERE p.lending_id = $1 AND p.payment_type IN ('payment','write_off')), 0) ...
```

Both outer queries are single-row (`WHERE lendings.id = X LIMIT 1`), so parameterizing is exactly
equivalent to correlation for these paths. The SQLite branches of both functions already use a correct
correlated `p.lending_id = l.id` and are **not** touched.

**Alternative (if true correlation is preferred):** build the scalar subquery with Drizzle's query
builder so `eq()` emits the qualified reference:

```ts
const resolvedSub = db.select({ v: sql<string>`COALESCE(SUM(${lendingPayments.amount}), 0)` })
  .from(lendingPayments)
  .where(and(eq(lendingPayments.lending_id, lendings.id), inArray(lendingPayments.payment_type, ['payment', 'write_off'])));
// resolved: sql<string>`(${resolvedSub})`
```

generating `"lending_payments"."lending_id" = "lendings"."id"`. Larger change; not needed for these
single-row queries. **Recommendation: the parameterized one-liner.**

Verification of the generated SQL: add a `.toSQL()` probe assertion in the verification test
(see §6) proving the subquery no longer contains a bare `"id"`.

## 3. Root cause — Bug B (getLendingTotals JOIN multiplication)

**Affected:** `getLendingTotals` — both branches (Drizzle lines 888–906, SQLite lines 908–924).

The query aggregates over `lendings LEFT JOIN lending_payments`, so each lending row is duplicated
once per payment row. `total` is `COALESCE(SUM(lendings.amount), 0)`, which therefore **multiplies each
lending's amount by its payment count**:

```sql
SELECT COALESCE(SUM(l.amount), 0) AS total,        -- ✗ 1000 × 2 payments = 2000 for one 1000 lending
       COALESCE(SUM(CASE WHEN p.payment_type='payment'  THEN p.amount ELSE 0 END), 0) AS cash_paid,
       COALESCE(SUM(CASE WHEN p.payment_type='write_off' THEN p.amount ELSE 0 END), 0) AS written_off
FROM lendings l LEFT JOIN lending_payments p ON p.lending_id = l.id
WHERE l.user_id = $1 AND l.direction = $2;
```

Observed on real Neon: L1(1000, 2 payments) + Lwo(500, 1 payment) → `total = 2500` (expected 1500),
`outstanding = total − cashPaid − writtenOff = 2500 − 600 − 500 = 1400` (expected 400). `cashPaid`/
`writtenOff` are sums over payment rows and are correct — only `total` (and therefore `outstanding`) is
inflated. Identical shape in the SQLite branch (pre-existing defect, faithfully migrated).

## 4. Proposed fix B

Keep the existing `FROM … LEFT JOIN …` (needed for `cash_paid`/`written_off`) but make `total` an
independent, JOIN-free scalar subquery over the filtered lendings — a one-expression change per branch.

**Drizzle branch** (only the `total` expression changes):

```ts
total: sql<string>`COALESCE((SELECT SUM(li.amount) FROM ${lendings} li WHERE li.user_id = ${userId} AND li.direction = ${direction}), 0)`,
```

**SQLite branch** (only the `total` expression changes):

```sql
COALESCE((SELECT SUM(l2.amount) FROM lendings l2 WHERE l2.user_id = $1 AND l2.direction = $2), 0) AS total,
```

`cash_paid`/`written_off` and the `outstanding = total − cashPaid − writtenOff` derivation are unchanged;
the return shape `{ total, cashPaid, writtenOff, outstanding }` is unchanged. Scoping is identical
(user + direction) — the subquery is filtered by the same `userId`/`direction` the outer query uses.
Edge cases behave as today: a lending with 0 payments still contributes its full amount to `total`;
a user with no lendings still returns all zeros (aggregate over empty set + COALESCE).

## 5. Regression tests to add/update

**Unit — `tests/unit-test/lendingPayments.test.ts` (SQLite path, real in-memory DB):**

- New: `getLendingTotals` with one lending (1000) + two payments (400, 200) → expect
  `{ total: 1000, cashPaid: 600, writtenOff: 0, outstanding: 400 }` (reproduces Bug B; current code
  returns `total: 2000`). Must run against the real in-memory DB (not the mocked `queryOne` used by the
  existing two `getLendingTotals` mapping tests at lines 466–491, which never exercise the SQL).
- New: `deletePayment` reopen guard — settle a loan with two payments, delete one, assert
  `recalcStatusCache` returns `'active'` and cached `status` is `'active'` (locks in the SQLite path's
  correct correlation; also guards the fixed Drizzle semantics via parity).
- Update: the two existing `getLendingTotals` mapping tests are left as-is (they still verify the
  number-mapping contract).

**Real-Neon — `tests/unit-test/verify-drizzle.neon.test.ts`:**

- The four currently-FAILING checks must flip to PASS (see §6).
- Add a positive `.toSQL()` guard: for `recalcStatusCache`, assert the generated SQL references the
  outer lending correctly (no bare `"id"` in the subquery — i.e. `"lending_payments"."lending_id"` =
  `$n` or `"lendings"."id"`), so a regression of Bug A fails the verification suite even if the
  numbers happen to look right.
- Remove the throwaway `[diag …]` console.logs after the fix passes.

## 6. Real-Neon verification scenarios to rerun

Re-run the full gated suite (all ~150 checks) against `LOCAL_DEV_DATABASE_URL`:

```
VERIFY_NEON=1 npx vitest run --config vite.config.ts tests/unit-test/verify-drizzle.neon.test.ts
```

Expected: **152/152 PASS**. Specifically watch:

- deletePayment/recalcStatusCache section — `remaining 600 after delete`, `status active after delete`,
  `linked transaction deleted with payment`, `recalcStatusCache returns active after reopen` all PASS.
- getLendingTotals section — `total 1500`, `cashPaid 600`, `writtenOff 500`, `outstanding 400` all PASS
  (the 2-payment JOIN-multiplication case), plus the existing single-payment `total 1000` still PASS.
- Confirm cleanup (`afterAll` CASCADE delete + orphan sweep) still fully passes and an independent
  post-run query shows 0 `__neon_drizzle_%` users / 0 orphan rows.
- Confirm `npm run test:unit` = 167 passed | 1 skipped, and `npm run check` = 0 errors.

## 7. Behavior / output compatibility concerns

- **Bug A:** `recalcStatusCache` return type (`'active' | 'paid'`) and its `lendings.status` write are
  unchanged; `deletePayment` still returns void. For lendings with a single payment (the common case)
  the computed status is identical before/after. Only the previously-miscomputed cases (2+ payments or
  unrelated rows leaking into `resolved`) change, from wrong → correct.
- **Bug B:** `getLendingTotals` return shape and `cashPaid`/`writtenOff` are unchanged. `total` and
  `outstanding` are identical for lendings with 0–1 payments; they change only for lendings with 2+
  payment rows, from inflated → correct. Visible effect: Lending summary cards ("total lent",
  "outstanding") show correct numbers for multi-payment lendings — this is the intended fix.
- The Drizzle subquery shape changes from a broken correlated reference to a bound parameter; results
  are identical for these single-row queries. No consumer of either function changes its call site.
- No DDL, no migrations, no `query.ts`/SQLite changes, no unrelated refactors.
