import bcrypt from 'bcryptjs';

/**
 * Password hashing — the surviving piece of the legacy auth module (Auth-5).
 *
 * Only the bcrypt helpers remain. The legacy JWT session machinery
 * (`createToken` / `verifyToken` / `JWT_SECRET` / `jsonwebtoken`) was retired
 * with the Auth.js migration — Auth.js owns session tokens via `AUTH_SECRET`.
 * Existing `$2b$10$` hashes continue to verify unchanged.
 *
 * Consumers:
 * - Auth.js Credentials `authorize()` (src/auth.ts) → `verifyPassword()` via
 *   `verifyUserCredentials()` in `$lib/shared/utils/loginValidation.ts`.
 * - Seed data (`src/lib/database/init.ts`) + scripts (`scripts/seed-demo.*`,
 *   `scripts/verify-neon.ts`) + unit tests → `hashPassword()`.
 */
export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
	return bcrypt.compareSync(password, hash);
}
