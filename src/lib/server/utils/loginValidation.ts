/**
 * Credential verification — server-only (uses bcrypt via $lib/server/auth).
 */

import { verifyPassword } from '$lib/server/auth';

export type ValidationFailure = {
	valid: false;
	error: string;
};

export type CredentialVerificationSuccess = {
	valid: true;
	user: {
		id: number;
		username: string;
	};
};

/**
 * Verifies password against user hash using bcrypt verifyPassword.
 * Returns generic error message if user does not exist or password fails.
 */
export function verifyUserCredentials(
	user: { id: number; username: string; password_hash: string } | null | undefined,
	password: string
): ValidationFailure | CredentialVerificationSuccess {
	if (!user || !verifyPassword(password, user.password_hash)) {
		return {
			valid: false,
			error: 'Invalid username or password',
		};
	}

	return {
		valid: true,
		user: {
			id: user.id,
			username: user.username,
		},
	};
}