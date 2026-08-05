/**
 * Preferences — localStorage- backed typed store.
 *
 * Hydrates on load, writes on change.
 * NOTE: Server-synced preferences table is a future migration.
 *       For now, all settings live in localStorage only.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Preferences {
	theme: ThemeMode;
	currency: string;
	dateFormat: string;
	onboardingDismissed: boolean;
}

const STORAGE_KEY = 'budget-tracker-prefs';

const DEFAULT_PREFS: Preferences = {
	theme: 'system',
	currency: 'PHP',
	dateFormat: 'MMM DD, YYYY',
	onboardingDismissed: false,
};

function loadFromStorage(): Preferences {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			return { ...DEFAULT_PREFS, ...parsed };
		}
	} catch {
		// corrupted storage — reset
	}
	return { ...DEFAULT_PREFS };
}

function saveToStorage(prefs: Preferences): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// ─── Apply theme to <html> data-theme ───

function applyTheme(theme: ThemeMode): void {
	if (typeof document === 'undefined') return;
	let effective: string;
	if (theme === 'system') {
		effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	} else {
		effective = theme;
	}
	document.documentElement.setAttribute('data-theme', effective);
}

// ─── Rune state ───

const initial = loadFromStorage();
applyTheme(initial.theme);

export const prefs = $state<Preferences>(initial);

// ─── Effective theme (reactive) ───
// Single source of truth is the `data-theme` attribute on <html>, which
// applyTheme() owns. SSR-safe: false default server-side; read ONCE at mount
// (so dark-theme users never get a one-frame flash of light tints), then kept
// current by a MutationObserver.
export let isDark = $state(false);

if (typeof document !== 'undefined') {
	const syncIsDark = () => {
		isDark = document.documentElement.getAttribute('data-theme') === 'dark';
	};
	syncIsDark();
	const themeObserver = new MutationObserver(syncIsDark);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme']
	});
}

// ─── Update helper (persists + applies on change) ───

export function updatePrefs(partial: Partial<Preferences>): void {
	Object.assign(prefs, partial);
	saveToStorage(prefs);
	if (partial.theme !== undefined) {
		applyTheme(prefs.theme);
	}
}

// ─── Convenience accessors ───

export function isOnboardingDismissed(): boolean {
	return prefs.onboardingDismissed;
}

export function dismissOnboarding(): void {
	prefs.onboardingDismissed = true;
	saveToStorage(prefs);
}

// ─── Listen for system theme changes when mode is 'system' ───

if (typeof window !== 'undefined') {
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	mq.addEventListener('change', () => {
		if (prefs.theme === 'system') {
			applyTheme('system');
		}
	});
}
