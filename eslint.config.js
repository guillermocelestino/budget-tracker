import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

export default tseslint.config(
	{
		ignores: [
			'**/.svelte-kit/**',
			'**/node_modules/**',
			'**/build/**',
			'**/.vercel/**',
			'**/package/**',
			'**/static/**',
			'**/dev-dist/**',
			'**/*.spec.ts',
			'**/*.test.ts',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],

	// Project tuning. `_`-prefixed names are intentionally unused (common
	// Svelte snippet/event params). The two Svelte rules below flag patterns
	// the codebase intentionally uses everywhere (plain URLSearchParams/Date,
	// fire-and-forget `goto()`, plain `<a download>` links); forcing them
	// would mean broad refactors of working code — revisit separately.
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
				},
			],
			'svelte/prefer-svelte-reactivity': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			// svelte-check (the authoritative compile/lint pass) still emits a11y
			// warnings that this rule claims are unused (parser-version skew), so
			// `svelte-ignore a11y_*` comments remain necessary — don't flag them.
			'svelte/no-unused-svelte-ignore': 'off',
		},
	},

	// Svelte files: route <script lang="ts"> through the TS parser.
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},

	// Standalone Svelte 5 runes files (.svelte.ts stores) can't be parsed as
	// plain TypeScript ($state/$derived aren't valid TS) — use the Svelte parser.
	{
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},

	// TypeScript + Svelte: turn off the base `no-undef` — TS's own checker
	// handles undefined variables, and the base rule false-positives on
	// SvelteKit's ambient `App` namespace (App.PageData, App.Locals).
	{
		files: ['**/*.{ts,svelte}'],
		rules: {
			'no-undef': 'off',
		},
	},

	// Browser-scoped code (components, routes, client utils).
	{
		files: ['**/*.{ts,svelte}'],
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
	},

	// Node-scoped code (config, build scripts, server-only modules).
	{
		files: ['**/*.server.ts', 'eslint.config.js', 'vite.config.ts', 'svelte.config.js', 'scripts/**/*.{js,mjs,ts}'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
);