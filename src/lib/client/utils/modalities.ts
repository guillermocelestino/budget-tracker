/**
 * WRECKRD — Product Taxonomy & Navigation Config
 * Shared navigation metadata mapping core product modalities to routes.
 */

export interface NavItemConfig {
	href: string;
	label: string;
	mobileLabel?: string;
	icon: string;
	emoji?: string;
	modality?: 'gone' | 'away' | 'committed' | 'position';
}

export const COMMAND_CENTER_NAV: NavItemConfig[] = [
	{
		href: '/dashboard',
		label: 'Command Center',
		mobileLabel: 'Command',
		icon: 'dashboard',
		emoji: '🎯'
	}
];

export const MONEY_OUT_NAV: NavItemConfig[] = [
	{
		href: '/transactions',
		label: 'Money Gone',
		mobileLabel: 'Gone',
		icon: 'money-gone',
		emoji: '🔥',
		modality: 'gone'
	},
	{
		href: '/lending',
		label: 'Money Away',
		mobileLabel: 'Away',
		icon: 'money-away',
		emoji: '🌊',
		modality: 'away'
	},
	{
		href: '/committed',
		label: 'Money Committed',
		mobileLabel: 'Committed',
		icon: 'money-committed',
		emoji: '🔒',
		modality: 'committed'
	},
	{
		href: '/net-worth',
		label: 'True Position',
		mobileLabel: 'Position',
		icon: 'true-position',
		emoji: '🎯',
		modality: 'position'
	}
];

export const EXPLORE_NAV: NavItemConfig[] = [
	{ href: '/money-map', label: 'Money Map', icon: 'money-map', emoji: '🗺' },
	{ href: '/analysis', label: 'Analysis', icon: 'reports', emoji: '📊' },
	{ href: '/categories', label: 'Categories', icon: 'categories', emoji: '🏷' },
	{ href: '/settings', label: 'Settings', icon: 'settings', emoji: '⚙' }
];
