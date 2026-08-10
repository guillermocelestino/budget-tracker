import { redirect } from '@sveltejs/kit';
import { signOutSession } from '../../auth';

export async function GET(event: import('@sveltejs/kit').RequestEvent) {
	// Sign out through the Auth.js signout action (src/auth.ts), which clears
	// the Auth.js session cookie (authjs.session-token). Safe with no session.
	await signOutSession(event);

	redirect(302, '/login');
}
