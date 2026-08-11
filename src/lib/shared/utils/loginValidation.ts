/**
 * Login input validation — pure, shared between client and server.
 *
 * Does NOT import server-only modules (no bcrypt, no $lib/server/auth).
 */

/**
 * Validates raw form input for login credentials.
 * Ensures username and password are provided and trims whitespace from username.
 */
export function validateLoginInput(
	rawUsername?: unknown,
	rawPassword?: unknown
): ValidationFailure | InputValidationSuccess {
	const username = (typeof rawUsername === 'string' ? rawUsername : '')?.trim();
	const password = typeof rawPassword === 'string' ? rawPassword : '';

	if (!username || !password) {
		return {
			valid: false,
			error: 'Username and password are required',
		};
	}

	return {
		valid: true,
		username,
		password,
	};
}

export type ValidationFailure = {
	valid: false;
	error: string;
};

export type InputValidationSuccess = {
	valid: true;
	username: string;
	password: string;
};