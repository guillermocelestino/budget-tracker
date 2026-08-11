import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup: mock SvelteKit environment modules before any imports
vi.mock('$app/environment', () => ({
	get dev() { return false; },
	get building() { return false; }
}));

vi.mock('$env/dynamic/private', () => ({
	get env() { return {}; }
}));

describe('AUTH_SECRET validation', () => {

	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('warns but allows empty AUTH_SECRET in development', async () => {
		// Re-mock for dev mode
		vi.doMock('$app/environment', () => ({
			get dev() { return true; },
			get building() { return false; }
		}));

		vi.doMock('$env/dynamic/private', () => ({
			get env() { return {}; }
		}));

		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await import('../../src/auth.ts');

		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining('AUTH_SECRET not set')
		);
		consoleWarnSpy.mockRestore();
	});

	it('warns but allows short AUTH_SECRET in development', async () => {
		vi.doMock('$app/environment', () => ({
			get dev() { return true; },
			get building() { return false; }
		}));

		vi.doMock('$env/dynamic/private', () => ({
			get env() { return { AUTH_SECRET: 'short' }; }
		}));

		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await import('../../src/auth.ts');

		expect(consoleWarnSpy).toHaveBeenCalledWith(
			expect.stringContaining('shorter than 32 characters')
		);
		consoleWarnSpy.mockRestore();
	});

	it('allows valid AUTH_SECRET (32+ chars) in development without warning', async () => {
		vi.doMock('$app/environment', () => ({
			get dev() { return true; },
			get building() { return false; }
		}));

		vi.doMock('$env/dynamic/private', () => ({
			get env() { return { AUTH_SECRET: 'a'.repeat(32) }; }
		}));

		const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await import('../../src/auth.ts');

		// No auth-related warnings expected
		const authWarnings = consoleWarnSpy.mock.calls.filter(call =>
			call[0]?.toString().includes('AUTH_SECRET')
		);
		expect(authWarnings).toHaveLength(0);
		consoleWarnSpy.mockRestore();
	});

	it('throws on missing AUTH_SECRET in production', async () => {
		vi.doMock('$app/environment', () => ({
			get dev() { return false; },
			get building() { return false; }
		}));

		vi.doMock('$env/dynamic/private', () => ({
			get env() { return {}; }
		}));

		await expect(import('../../src/auth.ts')).rejects.toThrow('AUTH_SECRET is required in production');
	});

	it('throws on short AUTH_SECRET in production', async () => {
		vi.doMock('$app/environment', () => ({
			get dev() { return false; },
			get building() { return false; }
		}));

		vi.doMock('$env/dynamic/private', () => ({
			get env() { return { AUTH_SECRET: 'short' }; }
		}));

		await expect(import('../../src/auth.ts')).rejects.toThrow('AUTH_SECRET must be at least 32 characters in production');
	});

	it('allows valid AUTH_SECRET (32+ chars) in production', async () => {
		vi.doMock('$app/environment', () => ({
			get dev() { return false; },
			get building() { return false; }
		}));

		vi.doMock('$env/dynamic/private', () => ({
			get env() { return { AUTH_SECRET: 'a'.repeat(32) }; }
		}));

		await expect(import('../../src/auth.ts')).resolves.toBeDefined();
	});

	it('skips validation entirely while building (SvelteKit build analysis)', async () => {
		vi.doMock('$app/environment', () => ({
			get dev() { return false; },
			get building() { return true; }
		}));

		vi.doMock('$env/dynamic/private', () => ({
			get env() { return {}; }
		}));

		// Production mode + no AUTH_SECRET, but `building` is true (vite build /
		// postbuild analysis): the module must load without throwing. The runtime
		// check below only applies once `building` is false at real server runtime.
		await expect(import('../../src/auth.ts')).resolves.toBeDefined();
	});
});