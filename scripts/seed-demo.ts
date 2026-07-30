/**
 * Demo Data Seeder for Budget Tracker
 *
 * Creates a dedicated "demo" user with rich, deterministic data
 * designed to exercise every living UI state.
 *
 * Run: SEED_DEMO=1 npx tsx scripts/seed-demo.ts
 * Or:  npx tsx scripts/seed-demo.ts
 *
 * Login: demo / Demo@2026!
 */

import { hashPassword } from '../src/lib/auth.js';
import { initDb } from '../src/lib/database/index.js';
import { queryOne, queryMany, execute } from '../src/lib/database/query.js';

// ============================================================
// ANCHOR DATE & HELPERS
// ============================================================
const TODAY = '2026-07-30';              // Hardcoded "today"
const CURRENT_MONTH = '2026-07';         // Current month
const YTD_START = '2026-01-01';          // YTD start

// Deterministic "random" using a simple seeded LCG (not Math.random)
function makeSeededRandom(seed = 12345) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

// ============================================================
// PERSONA DATA — Maria Santos, 29, Software Engineer
// ============================================================
const DEMO_USER = {
  username: 'demo',
  password: 'Demo@2026!',  // bcrypt hashed on insert
  // Monthly salary: ₱85,000
  // Rent: ₱18,000 (Bills & Utilities)
  // Discretionary: ~₱67,000
};

const INCOME_CATEGORIES = {
  SALARY: { name: 'Salary', budget: null },
  FREELANCE: { name: 'Freelance', budget: null },
  OTHER_INCOME: { name: 'Other Income', budget: null },
};

const EXPENSE_CATEGORIES = {
  FOOD: { name: 'Food & Dining', budget: 500 },
  TRANSPORT: { name: 'Transportation', budget: 200 },
  SHOPPING: { name: 'Shopping', budget: 300 },
  ENTERTAINMENT: { name: 'Entertainment', budget: 150 },
  BILLS: { name: 'Bills & Utilities', budget: 400 },
  HEALTHCARE: { name: 'Healthcare', budget: 200 },
  EDUCATION: { name: 'Education', budget: 100 },
  OTHER: { name: 'Other Expense', budget: null },
};

// ============================================================
// TRANSACTION GENERATOR
// ============================================================
function generateTransactions(catIds: Record<string, number>) {
  const txns: Array<{
    date: string;
    type: 'income' | 'expense';
    category_id: number;
    amount: number;
    description: string;
  }> = [];
  const rand = makeSeededRandom(42);

  function push(month: number, day: number, type: 'income' | 'expense', catKey: string, amount: number, desc: string) {
    const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    txns.push({ date, type, category_id: catIds[catKey], amount, description: desc });
  }

  for (let m = 1; m <= 7; m++) {
    const isCurrentMonth = m === 7;
    const daysInMonth = new Date(2026, m, 0).getDate();

    // --- SALARY (1st of month) ---
    push(m, 1, 'income', 'SALARY', 85000, `Salary - ${String(m).padStart(2, '0')}/2026`);

    // --- RENT (1st) ---
    push(m, 1, 'expense', 'BILLS', 18000, 'Monthly rent');

    // --- UTILITIES (5th) ---
    const utilityBase = 2500 + Math.round(rand() * 800);
    push(m, 5, 'expense', 'BILLS', utilityBase, 'Electricity & water');

    // --- INTERNET (10th) ---
    push(m, 10, 'expense', 'BILLS', 1500, 'Fiber internet');

    // --- FOOD & DINING ---
    let foodTotal = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const isWeekend = new Date(2026, m - 1, d).getDay() % 6 === 0;
      const daily = isWeekend
        ? 450 + Math.round(rand() * 200)
        : 280 + Math.round(rand() * 150);
      foodTotal += daily;
      if (d % 3 === 1 || isWeekend) {
        push(m, d, 'expense', 'FOOD', daily, isWeekend ? 'Weekend food delivery' : 'Lunch & snacks');
      }
    }
    // In July, add extra food to OVERSHOOT budget
    if (m === 7) {
      push(7, 28, 'expense', 'FOOD', 1500, 'Team dinner');
      push(7, 29, 'expense', 'FOOD', 1200, 'Birthday dinner');
      push(7, 30, 'expense', 'FOOD', 800, 'Friday night out');
      // REFUND: -1290 on Shopping, "Refund — returned jacket"
      push(7, 25, 'expense', 'SHOPPING', -1290, 'Refund — returned jacket');
    }

    // --- TRANSPORT ---
    const transportTrips = isCurrentMonth ? 3 : 8;
    for (let i = 0; i < transportTrips; i++) {
      const day = 3 + i * 4;
      if (day <= daysInMonth) {
        push(m, day, 'expense', 'TRANSPORT', isCurrentMonth ? 300 : 150, 'Grab/MRT');
      }
    }

    // --- SHOPPING ---
    const shoppingCount = isCurrentMonth ? 4 : 2;
    for (let i = 0; i < shoppingCount; i++) {
      const day = 7 + i * 5;
      if (day <= daysInMonth) {
        push(m, day, 'expense', 'SHOPPING', isCurrentMonth ? 990 : 220, 'Online shopping');
      }
    }

    // --- ENTERTAINMENT ---
    const entCount = isCurrentMonth ? 2 : 3;
    for (let i = 0; i < entCount; i++) {
      const day = 12 + i * 6;
      if (day <= daysInMonth) {
        push(m, day, 'expense', 'ENTERTAINMENT', 350, 'Movies/streaming');
      }
    }

    // --- HEALTHCARE ---
    if (m === 3 || m === 6) push(m, 15, 'expense', 'HEALTHCARE', 1200, 'Dental checkup');
    if (m === 5) push(m, 20, 'expense', 'HEALTHCARE', 800, 'Flu meds');

    // --- EDUCATION ---
    if (m === 2 || m === 5) push(m, 10, 'expense', 'EDUCATION', 900, 'Online course');

    // --- FREELANCE INCOME ---
    if (m === 2) push(m, 20, 'income', 'FREELANCE', 12000, 'Side project');
    if (m === 4) push(m, 18, 'income', 'FREELANCE', 8500, 'Consulting');
    if (m === 6) push(m, 25, 'income', 'FREELANCE', 15000, 'Contract work');

    // --- OTHER INCOME ---
    if (m === 1) push(m, 14, 'income', 'OTHER_INCOME', 5000, 'Birthday gift');
    if (m === 7) push(m, 15, 'income', 'OTHER_INCOME', 3000, 'Cash gift');

    // --- OTHER EXPENSE ---
    if (m % 3 === 0) push(m, 28, 'expense', 'OTHER', 450, 'Miscellaneous');
  }

  return txns;
}

// ============================================================
// LENDING GENERATOR
// ============================================================
function generateLendings() {
  return [
    // --- LENT (assets) ---
    {
      borrower_name: 'Carlo',
      amount: 15000,
      interest_rate: 0,
      date_lent: '2026-06-01',
      due_date: '2026-08-15',      // NOT YET DUE (teal)
      status: 'active' as const,
      notes: 'Laptop purchase',
      direction: 'lent' as const,
    },
    {
      borrower_name: 'Jessa',
      amount: 8000,
      interest_rate: 0,
      date_lent: '2026-05-15',
      due_date: '2026-07-10',      // OVERDUE (coral pulse, 20 days overdue)
      status: 'active' as const,
      notes: 'Emergency loan',
      direction: 'lent' as const,
    },
    {
      borrower_name: 'Mark',
      amount: 25000,
      interest_rate: 0,
      date_lent: '2026-03-01',
      due_date: '2026-06-30',
      status: 'paid' as const,     // CLEARED (sky)
      notes: 'Motorcycle downpayment',
      direction: 'lent' as const,
    },

    // --- BORROWED (liabilities) ---
    {
      borrower_name: 'Tita Beth',
      amount: 12000,
      interest_rate: 0,
      date_lent: '2026-06-15',
      due_date: '2026-08-01',      // ACTIVE, not yet due (coral accent)
      status: 'active' as const,
      notes: 'Tuition help',
      direction: 'borrowed' as const,
    },
    {
      borrower_name: 'Kuya Jon',
      amount: 20000,
      interest_rate: 0,
      date_lent: '2026-04-01',
      due_date: '2026-06-15',
      status: 'paid' as const,     // REPAID (sky)
      notes: 'Business capital',
      direction: 'borrowed' as const,
    },
    {
      borrower_name: 'Aling Rosa',
      amount: 5000,
      interest_rate: 0,
      date_lent: '2026-06-01',
      due_date: '2026-07-20',      // OVERDUE (10 days overdue, coral pulse)
      status: 'active' as const,
      notes: 'Medical emergency',
      direction: 'borrowed' as const,
    },
  ];
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function seedDemo() {
  console.log('🌱 Starting demo seed...');

  // Ensure schema exists
  await initDb();

  // 1. Create or get demo user
  let demoUser = await queryOne<{ id: number }>(
    'SELECT id FROM users WHERE username = $1',
    ['demo']
  );

  if (!demoUser) {
    const hash = hashPassword(DEMO_USER.password);
    await execute(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [DEMO_USER.username, hash]
    );
    demoUser = await queryOne<{ id: number }>('SELECT id FROM users WHERE username = $1', ['demo']);
    console.log(`✅ Created demo user (id: ${demoUser!.id})`);
    console.log(`   Login: demo / ${DEMO_USER.password}`);
  } else {
    console.log(`✅ Demo user already exists (id: ${demoUser.id})`);
  }

  const userId = demoUser!.id;

  // 2. Get or create categories for demo user
  let existingCats = await queryMany(
    `SELECT id, name FROM categories WHERE user_id = $1`,
    [userId]
  );

  if (existingCats.length === 0) {
    const defaultCats = [
      { name: 'Salary', color: '#10b981', icon: '💰', type: 'income', budget_limit: null },
      { name: 'Freelance', color: '#34d399', icon: '💻', type: 'income', budget_limit: null },
      { name: 'Other Income', color: '#6ee7b7', icon: '💵', type: 'income', budget_limit: null },
      { name: 'Food & Dining', color: '#ef4444', icon: '🍽️', type: 'expense', budget_limit: 8000 },
      { name: 'Transportation', color: '#f97316', icon: '🚗', type: 'expense', budget_limit: 2500 },
      { name: 'Shopping', color: '#f59e0b', icon: '🛍️', type: 'expense', budget_limit: 3000 },
      { name: 'Entertainment', color: '#8b5cf6', icon: '🎬', type: 'expense', budget_limit: 1500 },
      { name: 'Bills & Utilities', color: '#3b82f6', icon: '📄', type: 'expense', budget_limit: 25000 },
      { name: 'Healthcare', color: '#ec4899', icon: '🏥', type: 'expense', budget_limit: 2000 },
      { name: 'Education', color: '#14b8a6', icon: '📚', type: 'expense', budget_limit: 1000 },
      { name: 'Other Expense', color: '#6b7280', icon: '📦', type: 'expense', budget_limit: null },
    ];

    for (const cat of defaultCats) {
      await execute(
        `INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, cat.name, cat.color, cat.icon, cat.type, cat.budget_limit]
      );
    }
    console.log('✅ Created categories for demo user');
    existingCats = await queryMany(`SELECT id, name FROM categories WHERE user_id = $1`, [userId]);
  }

  // Map category names to IDs
  const catIds: Record<string, number> = {};
  const nameMap = {
    SALARY: 'Salary',
    FREELANCE: 'Freelance',
    OTHER_INCOME: 'Other Income',
    FOOD: 'Food & Dining',
    TRANSPORT: 'Transportation',
    SHOPPING: 'Shopping',
    ENTERTAINMENT: 'Entertainment',
    BILLS: 'Bills & Utilities',
    HEALTHCARE: 'Healthcare',
    EDUCATION: 'Education',
    OTHER: 'Other Expense',
  };
  for (const [key, name] of Object.entries(nameMap)) {
    const found = existingCats.find(c => c.name === name);
    if (found) catIds[key] = found.id;
  }

  // 3. Delete existing transactions for demo user (idempotent re-seed)
  await execute('DELETE FROM transactions WHERE user_id = $1', [userId]);
  console.log('🧹 Cleared existing transactions for demo user');

  // 4. Insert transactions
  const txns = generateTransactions(catIds);
  console.log(`📝 Inserting ${txns.length} transactions...`);
  for (const t of txns) {
    await execute(
      `INSERT INTO transactions (user_id, amount, description, date, category_id, type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, t.amount, t.description, t.date, t.category_id, t.type]
    );
  }
  console.log('✅ Transactions inserted');

  // 5. Delete existing lendings for demo user (idempotent re-seed)
  await execute('DELETE FROM lendings WHERE user_id = $1', [userId]);
  console.log('🧹 Cleared existing lendings for demo user');

  // 6. Insert lendings
  const lendings = generateLendings();
  console.log(`🤝 Inserting ${lendings.length} lending records...`);
  for (const l of lendings) {
    await execute(
      `INSERT INTO lendings (user_id, borrower_name, amount, interest_rate, date_lent, due_date, status, notes, direction)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, l.borrower_name, l.amount, l.interest_rate, l.date_lent, l.due_date, l.status, l.notes, l.direction]
    );
  }
  console.log('✅ Lendings inserted');

  // 7. Verify
  const txnCount = await queryOne('SELECT COUNT(*) as c FROM transactions WHERE user_id = $1', [userId]);
  const lendCount = await queryOne('SELECT COUNT(*) as c FROM lendings WHERE user_id = $1', [userId]);
  const catCount = await queryOne('SELECT COUNT(*) as c FROM categories WHERE user_id = $1', [userId]);

  console.log('\n📊 Demo seed complete!');
  console.log(`   User: demo (id: ${userId})`);
  console.log(`   Password: ${DEMO_USER.password}`);
  console.log(`   Categories: ${catCount.c}`);
  console.log(`   Transactions: ${txnCount.c}`);
  console.log(`   Lendings: ${lendCount.c}`);

  return { userId, txnCount: txnCount.c, lendCount: lendCount.c };
}

// ============================================================
// CLI ENTRY POINT
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}

export { seedDemo, DEMO_USER };