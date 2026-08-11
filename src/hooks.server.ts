import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';
import type { Handle } from '@sveltejs/kit';

/**
 * Auth-3/Auth-5 — protected-route authentication resolves through the Auth.js
 * session (`event.locals.auth()`), mapping its `user` back onto the app's
 * native `App.Locals.user` shape `{ userId, username }` so all existing server
 * routes and `$lib/server/*` services keep working unchanged.
 *
 * The legacy JWT `session`-cookie verification is retired (Auth-3) and the
 * legacy machinery removed entirely (Auth-5): `JWT_SECRET` guard, `jsonwebtoken`,
 * `createToken`/`verifyToken`. Auth.js session cookie (`authjs.session-token`)
 * is the sole session mechanism; `AUTH_SECRET` is enforced by Auth.js itself.
 */
const authGuardHandle: Handle = async ({ event, resolve }) => {
	// Root path redirects to dashboard
	if (event.url.pathname === '/') {
		return new Response(null, {
			status: 302,
			headers: { location: '/dashboard' },
		});
	}

	const publicPaths = ['/login'];

	if (!publicPaths.includes(event.url.pathname)) {
		const session = await event.locals.auth();
		const user = session?.user;

		if (user && typeof user.userId === 'number' && typeof user.username === 'string') {
			event.locals.user = { userId: user.userId, username: user.username };
			return resolve(event);
		}

		return new Response(null, {
			status: 302,
			headers: { location: '/login' },
		});
	}

	return resolve(event);
};

export const handle: Handle = sequence(authHandle, authGuardHandle);
