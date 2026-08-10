/**
 * Global category → hue system — single source of truth for every list page's
 * bar / chip / pill. All hues are calm desaturated cuts (no saturated defaults,
 * no royal blue). Theme-aware: dark mode raises tint alpha and lightens text
 * ~35% toward white so every category passes AA on dark surfaces.
 */

export const CATEGORY_HUES: Record<string, string> = {
	Salary: '#3f8f79',
	Freelance: '#5f9d8a',
	'Other Income': '#7b9f91',
	'Food & Dining': '#c0564f',
	Transportation: '#c07a3e',
	Shopping: '#b0864d',
	Entertainment: '#8f7ab8',
	'Bills & Utilities': '#468499',
	Healthcare: '#c56a8b',
	Education: '#4f8f9e',
	'Other Expense': '#7a8986'
};

// Bills & Utilities gets a fixed solid tint in LIGHT only; dark falls back to
// withAlpha(hue, 0.22) like every other category.
const CATEGORY_TINTS: Record<string, string> = {
	'Bills & Utilities': '#e0eef2'
};

// Fallback teal (mint family) for unknown categories / forbidden DB hues.
const FALLBACK_HUE = '#4f9d88';

const KEYWORD_HUES: Array<[RegExp, string]> = [
	[/salary|cash|income/i, '#3f8f79'], // teal
	[/food|dining|grocer|restaurant|cafe/i, '#c0564f'], // rose
	[/entertain|movie|game|stream/i, '#8f7ab8'], // violet
	[/shop|retail|cloth|amazon/i, '#b0864d'], // amber
	[/transport|travel|fuel|gas|taxi|transit/i, '#c07a3e'], // orange
	[/bill|utilit|rent|mortgage|electric|water|internet|phone|subscription/i, '#468499'] // ocean
];

function hexToRgb(hex: string): [number, number, number] {
	const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
	return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [79, 157, 136];
}

function withAlpha(hex: string, alpha: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isForbiddenHue(hex: string): boolean {
	const [r0, g0, b0] = hexToRgb(hex);
	const r = r0 / 255;
	const g = g0 / 255;
	const b = b0 / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	if (d === 0) return false;
	let h: number;
	if (max === r) h = ((g - b) / d) % 6;
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	h = (h * 60 + 360) % 360;
	// blue → indigo → violet
	return h >= 205 && h < 305;
}

/** Lighten a hex color toward white by `amount` (0..1). */
export function lightenHex(hex: string, amount: number): string {
	const [r, g, b] = hexToRgb(hex);
	const mix = (c: number) => Math.round(c + (255 - c) * amount);
	return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Resolve a category's hue: exact map → keyword → dbColor → fallback. */
export function getCategoryHue(name: string | null | undefined, dbColor: string | null | undefined): string {
	const n = name || '';
	if (CATEGORY_HUES[n]) return CATEGORY_HUES[n];
	for (const [re, hue] of KEYWORD_HUES) {
		if (re.test(n)) return hue;
	}
	const c = dbColor || FALLBACK_HUE;
	return isForbiddenHue(c) ? FALLBACK_HUE : c;
}

/** Background tint for a category chip/pill/bar. Dark raises alpha to 0.22. */
export function getCategoryTint(name: string | null | undefined, hue: string, isDark = false): string {
	const n = name || '';
	if (!isDark && CATEGORY_TINTS[n]) return CATEGORY_TINTS[n];
	return withAlpha(hue, isDark ? 0.22 : 0.12);
}

/** Foreground (text/glyph) for a category chip/pill. Dark lightens ~35% toward white. */
export function getCategoryText(name: string | null | undefined, hue: string, isDark = false): string {
	if (!isDark) return hue;
	return lightenHex(hue, 0.35);
}
