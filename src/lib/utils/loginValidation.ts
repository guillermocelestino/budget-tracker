import { verifyPassword } from '$lib/auth';

export type ValidationFailure = {
	valid: false;
	error: string;
};

export type InputValidationSuccess = {
	valid: true;
	username: string;
	password: string;
};

export type CredentialVerificationSuccess = {
	valid: true;
	user: {
		id: number;
		username: string;
	};
};

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
