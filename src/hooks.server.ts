import { verifyToken } from '$lib/auth';
import type { Handle } from '@sveltejs/kit';

// Validate critical env vars on Vercel before any request is served
if (process.env['POSTGRES_URL'] && !process.env['JWT_SECRET']) {
	throw new Error(
		'JWT_SECRET environment variable is required when POSTGRES_URL is set. ' +
		'Set it in Vercel project settings.'
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	// Root path redirects to dashboard
	if (event.url.pathname === '/') {
		return new Response(null, {
			status: 302,
			headers: { location: '/dashboard' },
		});
	}

	const publicPaths = ['/login'];

	if (!publicPaths.includes(event.url.pathname)) {
		const token = event.cookies.get('session');
		if (token) {
			const payload = verifyToken(token);
			if (payload) {
				event.locals.user = payload;
				return resolve(event);
			}
		}

		return new Response(null, {
			status: 302,
			headers: { location: '/login' },
		});
	}

	return resolve(event);
};
