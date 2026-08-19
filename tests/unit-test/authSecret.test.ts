import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockDev = false;
let mockBuilding = false;
let mockEnv: Record<string, string | undefined> = {};

vi.mock('$app/environment', () => ({
	get dev() { return mockDev; },
	get building() { return mockBuilding; }
}));

vi.mock('$env/dynamic/private', () => ({
	get env() { return mockEnv; }
}));

describe('AUTH_SECRET validation', () => {

	beforeEach(() => {
		vi.resetModules();
		mockDev = false;
		mockBuilding = false;
		mockEnv = {};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('warns but allows empty AUTH_SECRET in development', async () => {
		mockDev = true;
		mockEnv = {};

		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await import('../../src/auth.ts');

		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining('AUTH_SECRET not set')
		);
		consoleWarnSpy.mockRestore();
	});

	it('warns but allows short AUTH_SECRET in development', async () => {
		mockDev = true;
		mockEnv = { AUTH_SECRET: 'short' };

		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await import('../../src/auth.ts');

		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining('shorter than 32 characters')
		);
		consoleWarnSpy.mockRestore();
	});

	it('allows valid AUTH_SECRET (32+ chars) in development without warning', async () => {
		mockDev = true;
		mockEnv = { AUTH_SECRET: 'a'.repeat(32) };

		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await import('../../src/auth.ts');

		const authWarnings = consoleWarnSpy.mock.calls.filter(call =>
			call[0]?.toString().includes('AUTH_SECRET')
		);
		expect(authWarnings).toHaveLength(0);
		consoleWarnSpy.mockRestore();
	});

	it('throws on missing AUTH_SECRET in production', async () => {
		mockDev = false;
		mockEnv = {};

		await expect(import('../../src/auth.ts')).rejects.toThrow('AUTH_SECRET is required in production');
	});

	it('throws on short AUTH_SECRET in production', async () => {
		mockDev = false;
		mockEnv = { AUTH_SECRET: 'short' };

		await expect(import('../../src/auth.ts')).rejects.toThrow('AUTH_SECRET must be at least 32 characters in production');
	});

	it('allows valid AUTH_SECRET (32+ chars) in production', async () => {
		mockDev = false;
		mockEnv = { AUTH_SECRET: 'a'.repeat(32) };

		await expect(import('../../src/auth.ts')).resolves.toBeDefined();
	});

	it('skips validation entirely while building (SvelteKit build analysis)', async () => {
		mockDev = false;
		mockBuilding = true;
		mockEnv = {};

		await expect(import('../../src/auth.ts')).resolves.toBeDefined();
	});
});