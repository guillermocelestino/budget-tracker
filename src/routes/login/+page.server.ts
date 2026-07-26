import { fail, redirect } from '@sveltejs/kit';
import { queryOne } from '$lib/database/query';
import { verifyPassword, createToken } from '$lib/auth';

export function load({ locals }: { locals: App.Locals }) {
	if (locals.user) {
		redirect(302, '/dashboard');
	}
}

export const actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();

		const username = (data.get('username') as string)?.trim();
		const password = data.get('password') as string;

		if (!username || !password) {
			return fail(400, { error: 'Username and password are required' });
		}

		const user = await queryOne<{ id: number; username: string; password_hash: string }>(
			'SELECT id, username, password_hash FROM users WHERE username = $1',
			[username]
		);

		if (!user || !verifyPassword(password, user.password_hash)) {
			return fail(401, { error: 'Invalid username or password' });
		}

		const token = createToken(user.id, user.username);

		cookies.set('session', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7, // 7 days
			secure: process.env['NODE_ENV'] === 'production',
		});

		redirect(302, '/dashboard');
	},
};
