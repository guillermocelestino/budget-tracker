import { fail, redirect } from '@sveltejs/kit';
import { authenticateCredentials } from '../../auth';
import { validateLoginInput } from '$lib/utils/loginValidation';

export function load({ locals }: { locals: App.Locals }) {
	if (locals.user) {
		redirect(302, '/dashboard');
	}
}

export const actions = {
	default: async (event: import('@sveltejs/kit').RequestEvent) => {
		const data = await event.request.formData();

		const inputResult = validateLoginInput(data.get('username'), data.get('password'));
		if (!inputResult.valid) {
			return fail(400, { error: inputResult.error });
		}

		// Authenticate through the Auth.js Credentials provider (src/auth.ts) —
		// the single `authorize()` implementation. No duplicate user lookup,
		// bcrypt verification, or token creation here.
		const result = await authenticateCredentials(event, inputResult.username, inputResult.password);
		if (!result.ok) {
			return fail(401, { error: 'Invalid username or password' });
		}

		redirect(302, '/dashboard');
	},
};
