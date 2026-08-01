import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword } from '$lib/auth';
import {
	validateLoginInput,
	verifyUserCredentials,
} from '$lib/utils/loginValidation';

/**
 * Unit Test Suite for Login Validation & Credential Verification.
 *
 * Sourced/generated real bcrypt hashes for mock user data per Option (a).
 * Tests pure logic without DOM, network, or database dependencies.
 */

describe('loginValidation — Input Validation', () => {
	it('empty username + empty password -> expected error', () => {
		const result = validateLoginInput('', '');
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toBe('Username and password are required');
		}
	});

	it('missing or undefined input -> expected error', () => {
		const result = validateLoginInput(undefined, undefined);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toBe('Username and password are required');
		}
	});

	it('whitespace-only username is trimmed and treated as invalid', () => {
		const result = validateLoginInput('   ', 'password123');
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toBe('Username and password are required');
		}
	});

	it('whitespace-only password is treated as empty/invalid', () => {
		const result = validateLoginInput('validuser', '');
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toBe('Username and password are required');
		}
	});

	it('valid input trims username and preserves password', () => {
		const result = validateLoginInput('  demo  ', 'Demo@2026!');
		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.username).toBe('demo');
			expect(result.password).toBe('Demo@2026!');
		}
	});
});

describe('loginValidation — Credential Verification (Real Bcrypt Hashes)', () => {
	let mockUsers: Array<{ id: number; username: string; password_hash: string; rawPass: string }>;

	beforeAll(() => {
		// Real bcrypt hashes generated via $lib/auth hashPassword
		mockUsers = [
			{
				id: 1,
				username: 'pangdiin',
				rawPass: 'Pangdiin@123',
				password_hash: hashPassword('Pangdiin@123'),
			},
			{
				id: 2,
				username: 'celestinobelle',
				rawPass: 'Pangdiin@123',
				password_hash: hashPassword('Pangdiin@123'),
			},
			{
				id: 3,
				username: 'demo',
				rawPass: 'Demo@2026!',
				password_hash: hashPassword('Demo@2026!'),
			},
		];
	});

	it('UNKNOWN username returns invalid credentials error without leaking existence', () => {
		const result = verifyUserCredentials(null, 'Demo@2026!');
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toBe('Invalid username or password');
		}
	});

	it('valid username + WRONG password returns invalid credentials error', () => {
		const demoUser = mockUsers.find((u) => u.username === 'demo')!;
		const result = verifyUserCredentials(demoUser, 'WrongPassword123');
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toBe('Invalid username or password');
		}
	});

	it('password is matched EXACTLY and case-sensitively via bcrypt', () => {
		const demoUser = mockUsers.find((u) => u.username === 'demo')!;

		// Exact match passes
		expect(verifyUserCredentials(demoUser, 'Demo@2026!').valid).toBe(true);

		// Lowercase password fails
		expect(verifyUserCredentials(demoUser, 'demo@2026!').valid).toBe(false);

		// Missing symbol fails
		expect(verifyUserCredentials(demoUser, 'Demo@2026').valid).toBe(false);

		// Trailing space fails
		expect(verifyUserCredentials(demoUser, 'Demo@2026! ').valid).toBe(false);
	});

	it('data-driven test: each of the 3 seeded users logs in with correct credentials', () => {
		for (const mockUser of mockUsers) {
			const result = verifyUserCredentials(mockUser, mockUser.rawPass);
			expect(result.valid).toBe(true);
			if (result.valid) {
				expect(result.user).toEqual({
					id: mockUser.id,
					username: mockUser.username,
				});
			}
		}
	});

	it('correct credentials return full identity payload { id, username }, not just boolean', () => {
		const demoUser = mockUsers.find((u) => u.username === 'demo')!;
		const result = verifyUserCredentials(demoUser, 'Demo@2026!');
		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.user.id).toBe(3);
			expect(result.user.username).toBe('demo');
		}
	});
});
