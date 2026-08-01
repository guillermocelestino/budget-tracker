import { fail, redirect } from '@sveltejs/kit';
import { queryOne } from '$lib/database/query';
import { createToken } from '$lib/auth';
import { validateLoginInput, verifyUserCredentials } from '$lib/utils/loginValidation';

export function load({ locals }: { locals: App.Locals }) {
	if (locals.user) {
		redirect(302, '/dashboard');
	}
}

export const actions = {
	default: async ({ request, cookies }: { request: Request; cookies: import('@sveltejs/kit').Cookies }) => {
		const data = await request.formData();

		const inputResult = validateLoginInput(data.get('username'), data.get('password'));
		if (!inputResult.valid) {
			return fail(400, { error: inputResult.error });
		}

		const user = await queryOne<{ id: number; username: string; password_hash: string }>(
			'SELECT id, username, password_hash FROM users WHERE username = $1',
			[inputResult.username]
		);

		const credResult = verifyUserCredentials(user, inputResult.password);
		if (!credResult.valid) {
			return fail(401, { error: credResult.error });
		}

		const token = createToken(credResult.user.id, credResult.user.username);

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
