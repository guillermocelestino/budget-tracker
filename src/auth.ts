import { SvelteKitAuth } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import {
	Auth,
	createActionURL,
	raw,
	setEnvDefaults as coreSetEnvDefaults,
	skipCSRFCheck,
} from '@auth/core';
import type { AuthConfig } from '@auth/core';
import type { DefaultSession, User } from '@auth/core/types';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { base } from '$app/paths';
import { queryOne } from '$lib/server/db/query';
import { validateLoginInput } from '$lib/shared/utils/loginValidation';
import { verifyUserCredentials } from '$lib/server/utils/loginValidation';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Auth.js migration (Auth-1 → Auth-4).
 *
 * `src/auth.ts` is the single source of truth for the Credentials provider:
 * - `authorize` authenticates against the EXISTING `users` table (same query as
 *   the former login action) + existing bcrypt `$2b$10$` hashes — no re-hash,
 *   no schema change, no adapter. Returns the app's native `{ userId, username }`.
 * - Session strategy is locked to `'jwt'` — no database session/account/
 *   verificationToken tables.
 * - `callbacks.jwt` carries `{ userId, username }` into the Auth.js token and
 *   `callbacks.session` surfaces them on `session.user` (see the `Session`
 *   module augmentation below).
 * - `authenticateCredentials` / `signOutSession` (used by `/login` and
 *   `/logout`) invoke the SAME Auth.js core with this config in-process, so
 *   there is exactly ONE authentication mechanism.
 *
 * Auth.js session is authoritative: `hooks.server.ts` resolves protected routes
 * via `event.locals.auth()` and maps `session.user` → `event.locals.user`.
 */
const authConfig: AuthConfig = {
	providers: [
		Credentials({
			credentials: {
				username: { label: 'Username', type: 'text' },
				password: { label: 'Password', type: 'password' },
			},
			async authorize(credentials) {
				// Single user lookup + bcrypt verification lives here.
				const inputResult = validateLoginInput(
					credentials?.username,
					credentials?.password
				);
				if (!inputResult.valid) return null;

				const dbUser = await queryOne<{ id: number; username: string; password_hash: string }>(
					'SELECT id, username, password_hash FROM users WHERE username = $1',
					[inputResult.username]
				);

				const credResult = verifyUserCredentials(dbUser, inputResult.password);
				if (!credResult.valid) return null;

				const authUser: CredentialsUser = {
					id: String(credResult.user.id),
					name: credResult.user.username,
					userId: credResult.user.id,
					username: credResult.user.username,
				};
				return authUser;
			},
		}),
	],
	session: { strategy: 'jwt' },
	callbacks: {
		jwt({ token, user }) {
			// The provider-returned user is present only when the token is first
			// minted at sign-in; carry the native identity into the JWT.
			if (user) {
				const authUser = user as CredentialsUser;
				token.userId = authUser.userId;
				token.username = authUser.username;
			}
			return token;
		},
		session({ session, token }) {
			// Mutate the fields rather than replace `session.user`: the callback
			// param types it as `AdapterUser & Session["user"]`, so a fresh object
			// would need adapter-only fields (id/email/emailVerified).
			session.user.userId = token.userId as number;
			session.user.username = token.username as string;
			return session;
		},
	},
};

export const { handle, signIn, signOut } = SvelteKitAuth(authConfig);

/**
 * The identity returned by `authorize` and read by the `jwt` callback: the
 * Auth.js `User` plus the app's native `{ userId, username }` identity.
 */
interface CredentialsUser extends User {
	userId: number;
	username: string;
}

/**
 * Widen Auth.js `Session.user` to carry the app's native identity. Without
 * this, `session.user` stays `User` and `callbacks.session` cannot type the
 * `{ userId, username }` shape it sets. Augmentation only — no runtime effect.
 */
declare module '@auth/core/types' {
	interface Session {
		user: {
			userId: number;
			username: string;
		} & DefaultSession['user'];
	}
}

/**
 * Resolve the Auth.js config with environment defaults, mirroring what
 * `@auth/sveltekit`'s `setEnvDefaults` does (trustHost from dev, `basePath`
 * = `${base}/auth`, `skipCSRFCheck`) so an in-process `Auth()` call behaves
 * identically to the `/auth/*` handle. Returns a copy — never mutates the
 * shared `authConfig` above.
 */
function resolveAuthConfig(): AuthConfig {
	const resolved: AuthConfig = { ...authConfig };
	resolved.trustHost ??= dev;
	resolved.basePath = `${base}/auth`;
	resolved.skipCSRFCheck = skipCSRFCheck;
	coreSetEnvDefaults(env, resolved);
	return resolved;
}

/**
 * Authenticate a username/password through the Auth.js Credentials provider
 * (the single `authorize()` implementation above). On success, applies the
 * Auth.js session cookie to the response and returns `{ ok: true }`; on invalid
 * credentials returns `{ ok: false }` and sets nothing. Delegates entirely to
 * Auth.js — no duplicate user lookup or bcrypt verification here.
 */
export async function authenticateCredentials(
	event: RequestEvent,
	username: string,
	password: string
): Promise<{ ok: boolean }> {
	const config = resolveAuthConfig();
	const { request } = event;
	const headers = new Headers(request.headers);
	headers.set('Content-Type', 'application/x-www-form-urlencoded');

	// POST to the same callback the `/auth/*` handle serves:
	// /auth/signin/credentials → /auth/callback/credentials
	const signInURL = createActionURL('signin', event.url.protocol, headers, env, config);
	const url = `${signInURL}/credentials`.replace('/signin/', '/callback/');

	const body = new URLSearchParams({
		username,
		password,
		callbackUrl: `${event.url.origin}/dashboard`,
	});
	const req = new Request(url, { method: 'POST', headers, body });

	try {
		const res = await Auth(req, { ...config, raw });
		for (const c of res?.cookies ?? []) {
			event.cookies.set(c.name, c.value, { path: '/', ...c.options });
		}
		return { ok: true };
	} catch {
		// Invalid credentials (CredentialsSignin) or any Auth.js failure.
		return { ok: false };
	}
}

/**
 * Sign the current user out through Auth.js: invokes the signout action
 * in-process and applies its cookies (which clear the Auth.js session cookie)
 * to the response. Safe to call with no active session — the signout action
 * never throws.
 */
export async function signOutSession(event: RequestEvent): Promise<void> {
	const config = resolveAuthConfig();
	const { request } = event;
	const headers = new Headers(request.headers);
	headers.set('Content-Type', 'application/x-www-form-urlencoded');

	const url = createActionURL('signout', event.url.protocol, headers, env, config);
	const body = new URLSearchParams({
		callbackUrl: `${event.url.origin}/login`,
	});
	const req = new Request(url, { method: 'POST', headers, body });

	const res = await Auth(req, { ...config, raw });
	for (const c of res?.cookies ?? []) {
		event.cookies.set(c.name, c.value, { path: '/', ...c.options });
	}
}
