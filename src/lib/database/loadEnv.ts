import fs from 'node:fs';
import path from 'node:path';

/**
 * Dev-only env wiring.
 *
 * SvelteKit/Vite dev does not load `.env` into `process.env`, so under
 * `npm run dev` the app sees no `DATABASE_URL` and falls back to SQLite even
 * after the Neon migration. This module closes that gap ONLY in development:
 *
 *   - It reads `LOCAL_DEV_DATABASE_URL` from `.env` and, when set, points the
 *     app at the local-dev Neon branch (the dev database).
 *   - It supplies the dev `JWT_SECRET` fallback so the hooks.server.ts guard
 *     (`DATABASE_URL` set → `JWT_SECRET` required) passes.
 *
 * Strictly inert outside development (production build on Vercel, standalone
 * tsx scripts) and whenever the caller already exported `DATABASE_URL` — an
 * explicit shell export always wins.
 *
 * E2E: Playwright's webserver runs with `SEED_DEMO=1` and seed-demo writes
 * SQLite, so the e2e dev server must NOT be redirected to local-dev. Hence
 * the `SEED_DEMO` gate.
 */
const isDev = process.env['NODE_ENV'] === 'development';

if (isDev && !process.env['SEED_DEMO'] && !process.env['DATABASE_URL']) {
	try {
		const raw = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
		let localDevUrl: string | undefined;
		for (const line of raw.split('\n')) {
			const m = line.match(/^\s*LOCAL_DEV_DATABASE_URL\s*=\s*(.*)\s*$/);
			if (m) {
				const value = m[1]!.trim();
				const quoted =
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"));
				localDevUrl = quoted ? value.slice(1, -1) : value;
				break;
			}
		}
		if (localDevUrl) {
			process.env['DATABASE_URL'] = localDevUrl;
			process.env['JWT_SECRET'] ??= 'budget-tracker-dev-secret-change-in-production';
		}
	} catch {
		// No `.env` in this environment — leave process.env untouched.
	}
}
