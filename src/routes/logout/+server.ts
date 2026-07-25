import { redirect } from '@sveltejs/kit';

export function GET({ cookies }: { cookies: import('@sveltejs/kit').Cookies }) {
	cookies.delete('session', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env['NODE_ENV'] === 'production',
	});

	redirect(302, '/login');
}
