/**
 * Demo seed data generator for budget-tracker.
 * Creates a dedicated "demo" user with deterministic, curated data that exercises
 * every visual state in the app. Run with SEED_DEMO=1 or import and call seedDemo().
 *
 * NON-DESTRUCTIVE: Only creates/updates the "demo" user. Never touches other users.
 */

import { hashPassword } from '../src/lib/auth.js';
import { execute, queryOne, queryMany } from '../src/lib/database/query.js';
import { initDb } from '../src/lib/database/init.js';

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

function addMonths(dateStr, months) {
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

// ============================================================
// PERSONA DATA — Maria Santos, 29, Software Engineer
// ============================================================
const DEMO_USER = {
  username: 'demo',
  password: 'Demo@12345',  // bcrypt hashed on insert
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
  FOOD: { name: 'Food & Dining', budget: 500, color: '#ef4444', icon: '🍽️' },
  TRANSPORT: { name: 'Transportation', budget: 200, color: '#f97316', icon: '🚗' },
  SHOPPING: { name: 'Shopping', budget: 300, color: '#f59e0b', icon: '🛍️' },
  ENTERTAINMENT: { name: 'Entertainment', budget: 150, color: '#8b5cf6', icon: '🎬' },
  BILLS: { name: 'Bills & Utilities', budget: 400, color: '#3b82f6', icon: '📄' },
  HEALTHCARE: { name: 'Healthcare', budget: 200, color: '#ec4899', icon: '🏥' },
  EDUCATION: { name: 'Education', budget: 100, color: '#14b8a6', icon: '📚' },
  OTHER: { name: 'Other Expense', budget: null, color: '#6b7280', icon: '📦' },
};

// ============================================================
// TRANSACTION DATASETS (deterministic, month-by-month)
// ============================================================

/**
 * Generates 7 months of transactions (Jan–Jul 2026) with:
 * - Salary every 1st
 * - Rent every 1st (Bills)
 * - Variable food/transport/shopping/entertainment
 * - Occasional freelance/other income
 * - Medical/education spikes
 * Designed so:
 * - Jul Food > ₱500 (OVERSPEND)
 * - Jul Shopping ~₱270 (NEAR LIMIT 90%)
 * - Jul Transport ~₱80 (ON TRACK 40%)
 * - Cumulative cash curve trends UP
 */
function generateTransactions(catIds) {
  const txns = [];
  const rand = makeSeededRandom(42); // deterministic

  // Helper to push a transaction
  const push = (month, day, type, catKey, amount, desc) => {
    const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    txns.push({
      date,
      type,
      category_id: catIds[catKey],
      amount,
      description: desc,
    });
  };

  for (let m = 1; m <= 7; m++) {
    const monthStr = String(m).padStart(2, '0');
    const isCurrentMonth = m === 7;

    // --- SALARY (1st of month) ---
    push(m, 1, 'income', 'SALARY', 85000, `Salary - ${monthStr}/2026`);

    // --- RENT (1st) ---
    push(m, 1, 'expense', 'BILLS', 18000, 'Monthly rent');

    // --- UTILITIES (5th) ---
    const utilityBase = 2500 + Math.round(rand() * 800); // 2500-3300
    push(m, 5, 'expense', 'BILLS', utilityBase, 'Electricity & water');

    // --- INTERNET (10th) ---
    push(m, 10, 'expense', 'BILLS', 1500, 'Fiber internet');

    // --- FOOD & DINING ---
    // Base daily food: ~₱300-500, higher on weekends
    const daysInMonth = new Date(2026, m, 0).getDate();
    let foodTotal = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const isWeekend = new Date(2026, m - 1, d).getDay() % 6 === 0;
      const daily = isWeekend
        ? 450 + Math.round(rand() * 200)   // ₱450-650
        : 280 + Math.round(rand() * 150);  // ₱280-430
      foodTotal += daily;
      // Only add every few days to keep row count reasonable
      if (d % 3 === 1 || isWeekend) {
        push(m, d, 'expense', 'FOOD', daily, isWeekend ? 'Weekend food delivery' : 'Lunch & snacks');
      }
    }
    // In July, add extra food to OVERSHOOT ₱500 budget
    if (m === 7) {
      // Already ~₱400/mo from daily, add ₱200 more on 28th, 29th, 30th
      push(7, 28, 'expense', 'FOOD', 650, 'Team dinner');
      push(7, 29, 'expense', 'FOOD', 480, 'Birthday dinner');
      push(7, 30, 'expense', 'FOOD', 520, 'Friday night out');
    }

    // --- TRANSPORT ---
    // Daily commute ~₱120 x 20 workdays = ₱2,400/mo, but budget is ₱200 (undershoot for demo)
    // Actually let's make transport ~₱80 in July to show ON-TRACK
    const transportTrips = isCurrentMonth ? 3 : 8; // fewer trips in current month
    for (let i = 0; i < transportTrips; i++) {
      const day = 3 + i * 4;
      if (day <= daysInMonth) {
        push(m, day, 'expense', 'TRANSPORT', isCurrentMonth ? 25 : 150, 'Grab/MRT');
      }
    }

    // --- SHOPPING ---
    // Monthly ~₱200-400, but July pushes to ~₱270 (90% of ₱300)
    const shoppingCount = isCurrentMonth ? 4 : 2;
    for (let i = 0; i < shoppingCount; i++) {
      const day = 7 + i * 5;
      if (day <= daysInMonth) {
        push(m, day, 'expense', 'SHOPPING', isCurrentMonth ? 70 : 220, 'Online shopping');
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

    // --- HEALTHCARE (occasional) ---
    if (m === 3 || m === 6) {
      push(m, 15, 'expense', 'HEALTHCARE', 1200, 'Dental checkup');
    }
    if (m === 5) {
      push(m, 20, 'expense', 'HEALTHCARE', 800, 'Flu meds');
    }

    // --- EDUCATION (occasional) ---
    if (m === 2 || m === 5) {
      push(m, 10, 'expense', 'EDUCATION', 900, 'Online course');
    }

    // --- FREELANCE INCOME (irregular) ---
    if (m === 2) push(m, 20, 'income', 'FREELANCE', 12000, 'Side project');
    if (m === 4) push(m, 18, 'income', 'FREELANCE', 8500, 'Consulting');
    if (m === 6) push(m, 25, 'income', 'FREELANCE', 15000, 'Contract work');

    // --- OTHER INCOME (gifts, etc.) ---
    if (m === 1) push(m, 14, 'income', 'OTHER_INCOME', 5000, 'Birthday gift');
    if (m === 7) push(m, 15, 'income', 'OTHER_INCOME', 3000, 'Cash gift');

    // --- OTHER EXPENSE ---
    if (m % 3 === 0) {
      push(m, 28, 'expense', 'OTHER', 450, 'Miscellaneous');
    }
  }

  return txns;
}

/**
 * LENDING DATA — exercises all states:
 * direction='lent': Carlo (on-track), Jessa (overdue), Mark (cleared)
 * direction='borrowed': Tita Beth (active), Kuya Jon (repaid), Aling Rosa (overdue)
 */
function generateLendings() {
  return [
    // --- LENT (assets) ---
    {
      borrower_name: 'Carlo',
      amount: 15000,
      interest_rate: 0,
      date_lent: '2026-06-01',
      due_date: '2026-08-15',      // NOT YET DUE (teal)
      status: 'active',
      notes: 'Laptop purchase',
      direction: 'lent',
    },
    {
      borrower_name: 'Jessa',
      amount: 8000,
      interest_rate: 0,
      date_lent: '2026-05-15',
      due_date: '2026-07-10',      // OVERDUE (coral pulse, 20 days overdue)
      status: 'active',
      notes: 'Emergency loan',
      direction: 'lent',
    },
    {
      borrower_name: 'Mark',
      amount: 25000,
      interest_rate: 0,
      date_lent: '2026-03-01',
      due_date: '2026-06-30',
      status: 'paid',               // CLEARED (sky)
      notes: 'Motorcycle downpayment',
      direction: 'lent',
    },

    // --- BORROWED (liabilities) ---
    {
      borrower_name: 'Tita Beth',
      amount: 12000,
      interest_rate: 0,
      date_lent: '2026-06-15',
      due_date: '2026-08-01',      // ACTIVE, not yet due (coral accent)
      status: 'active',
      notes: 'Tuition help',
      direction: 'borrowed',
    },
    {
      borrower_name: 'Kuya Jon',
      amount: 20000,
      interest_rate: 0,
      date_lent: '2026-04-01',
      due_date: '2026-06-15',
      status: 'paid',               // REPAID (sky)
      notes: 'Business capital',
      direction: 'borrowed',
    },
    {
      borrower_name: 'Aling Rosa',
      amount: 5000,
      interest_rate: 0,
      date_lent: '2026-06-01',
      due_date: '2026-07-20',      // OVERDUE (10 days overdue, coral pulse)
      status: 'active',
      notes: 'Medical emergency',
      direction: 'borrowed',
    },
  ];
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
export async function seedDemo() {
  console.log('🌱 Starting demo seed...');

  // Ensure schema exists
  await initDb();

  // 1. Create or get demo user
  let demoUser = await queryOne(
    'SELECT id FROM users WHERE username = $1',
    ['demo']
  );

  if (!demoUser) {
    const hash = hashPassword(DEMO_USER.password);
    await execute(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [DEMO_USER.username, hash]
    );
    demoUser = await queryOne('SELECT id FROM users WHERE username = $1', ['demo']);
    console.log(`✅ Created demo user (id: ${demoUser.id})`);
    console.log(`   Login: demo / ${DEMO_USER.password}`);
  } else {
    console.log(`✅ Demo user already exists (id: ${demoUser.id})`);
  }

  const userId = demoUser.id;

  // 2. Get or create categories for demo user
  // We'll use the same seeded categories that init creates for all users
  // But we need their IDs for this user
  const existingCats = await queryMany(
    `SELECT id, name FROM categories WHERE user_id = $1`,
    [userId]
  );

  let catIds = {};
  if (existingCats.length === 0) {
    // Create categories for demo user (reusing the DEFAULT_CATEGORIES from init)
    const defaultCats = [
      { name: 'Salary', color: '#10b981', icon: '💰', type: 'income', budget_limit: null },
      { name: 'Freelance', color: '#34d399', icon: '💻', type: 'income', budget_limit: null },
      { name: 'Other Income', color: '#6ee7b7', icon: '💵', type: 'income', budget_limit: null },
      { name: 'Food & Dining', color: '#ef4444', icon: '🍽️', type: 'expense', budget_limit: 500 },
      { name: 'Transportation', color: '#f97316', icon: '🚗', type: 'expense', budget_limit: 200 },
      { name: 'Shopping', color: '#f59e0b', icon: '🛍️', type: 'expense', budget_limit: 300 },
      { name: 'Entertainment', color: '#8b5cf6', icon: '🎬', type: 'expense', budget_limit: 150 },
      { name: 'Bills & Utilities', color: '#3b82f6', icon: '📄', type: 'expense', budget_limit: 400 },
      { name: 'Healthcare', color: '#ec4899', icon: '🏥', type: 'expense', budget_limit: 200 },
      { name: 'Education', color: '#14b8a6', icon: '📚', type: 'expense', budget_limit: 100 },
      { name: 'Other Expense', color: '#6b7280', icon: '📦', type: 'expense', budget_limit: null },
    ];

    for (const cat of defaultCats) {
      await execute(
        `INSERT INTO categories (user_id, name, color, icon, type, budget_limit) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, cat.name, cat.color, cat.icon, cat.type, cat.budget_limit]
      );
    }
    console.log('✅ Created categories for demo user');
  }

  // Fetch category IDs for this user
  const cats = await queryMany(
    `SELECT id, name FROM categories WHERE user_id = $1`,
    [userId]
  );
  for (const cat of cats) {
    // Map by name (lowercase, space → underscore)
    const key = cat.name.replace(/[ &]/g, '_').toUpperCase();
    catIds[key] = cat.id;
  }
  // Also add direct mappings
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
    const found = cats.find(c => c.name === name);
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
// Allow running directly: `node scripts/seed-demo.mjs`
// or `SEED_DEMO=1 node scripts/seed-demo.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    });
}