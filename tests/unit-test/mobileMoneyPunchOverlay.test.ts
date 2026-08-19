import { describe, it, expect } from 'vitest';
import type { PunchType } from '$lib/client/components/dashboard/MobileMoneyPunchOverlay.svelte';

function getPunchConfig(type: PunchType) {
	switch (type) {
		case 'spent':
			return {
				icon: '💸',
				title: 'MONEY OUT',
				subtitle: 'money left your pocket',
				accentColor: 'var(--color-coral, #ef4444)',
				glowColor: 'rgba(239, 108, 74, 0.35)',
				particleColor: 'rgba(239, 108, 74, 0.7)',
				particleDirection: 'down' as const
			};
		case 'income':
			return {
				icon: '💰',
				title: 'MONEY IN',
				subtitle: 'money entered your pocket',
				accentColor: 'var(--color-teal, #2BA8A2)',
				glowColor: 'rgba(43, 168, 162, 0.35)',
				particleColor: 'rgba(43, 168, 162, 0.7)',
				particleDirection: 'up' as const
			};
		case 'lent':
			return {
				icon: '🤝',
				title: 'MONEY AWAY',
				subtitle: 'money left your hands',
				accentColor: 'var(--color-gold, #f59e0b)',
				glowColor: 'rgba(255, 210, 63, 0.35)',
				particleColor: 'rgba(255, 210, 63, 0.7)',
				particleDirection: 'down' as const
			};
		case 'borrowed':
			return {
				icon: '📥',
				title: 'MONEY COMMITTED',
				subtitle: 'money entered your pocket with an obligation',
				accentColor: '#8b5cf6',
				glowColor: 'rgba(139, 92, 246, 0.35)',
				particleColor: 'rgba(139, 92, 246, 0.7)',
				particleDirection: 'up' as const
			};
		case 'repaid':
			return {
				icon: '🧾',
				title: 'MONEY COMMITTED',
				subtitle: 'an obligation left your pocket',
				accentColor: '#f97316',
				glowColor: 'rgba(249, 115, 22, 0.35)',
				particleColor: 'rgba(249, 115, 22, 0.7)',
				particleDirection: 'down' as const
			};
		case 'recurring':
			return {
				icon: '🔄',
				title: 'MONEY COMMITTED',
				subtitle: 'a recurring payment left your pocket',
				accentColor: '#0ea5e9',
				glowColor: 'rgba(14, 165, 233, 0.35)',
				particleColor: 'rgba(14, 165, 233, 0.7)',
				particleDirection: 'down' as const
			};
		default:
			return {
				icon: '💸',
				title: 'MONEY OUT',
				subtitle: 'money left your pocket',
				accentColor: 'var(--color-coral, #ef4444)',
				glowColor: 'rgba(239, 108, 74, 0.35)',
				particleColor: 'rgba(239, 108, 74, 0.7)',
				particleDirection: 'down' as const
			};
	}
}

describe('MobileMoneyPunchOverlay — Punch Type Configurations', () => {
	it('returns the dedicated borrowed configuration', () => {
		const config = getPunchConfig('borrowed');
		expect(config).toEqual({
			icon: '📥',
			title: 'MONEY COMMITTED',
			subtitle: 'money entered your pocket with an obligation',
			accentColor: '#8b5cf6',
			glowColor: 'rgba(139, 92, 246, 0.35)',
			particleColor: 'rgba(139, 92, 246, 0.7)',
			particleDirection: 'up'
		});
	});

	it('returns the dedicated recurring configuration', () => {
		const config = getPunchConfig('recurring');
		expect(config).toEqual({
			icon: '🔄',
			title: 'MONEY COMMITTED',
			subtitle: 'a recurring payment left your pocket',
			accentColor: '#0ea5e9',
			glowColor: 'rgba(14, 165, 233, 0.35)',
			particleColor: 'rgba(14, 165, 233, 0.7)',
			particleDirection: 'down'
		});
	});

	it('ensures recurring is NOT displayed as spent or income', () => {
		const recurringConfig = getPunchConfig('recurring');
		const spentConfig = getPunchConfig('spent');
		const incomeConfig = getPunchConfig('income');

		expect(recurringConfig.title).toBe('MONEY COMMITTED');
		expect(recurringConfig.title).not.toBe(spentConfig.title);
		expect(recurringConfig.title).not.toBe(incomeConfig.title);
		expect(recurringConfig.icon).toBe('🔄');
		expect(recurringConfig.accentColor).toBe('#0ea5e9');
		expect(recurringConfig.particleDirection).toBe('down');
	});

	it('preserves existing configs for spent, income, lent, borrowed, and repaid', () => {
		expect(getPunchConfig('spent').title).toBe('MONEY OUT');
		expect(getPunchConfig('income').title).toBe('MONEY IN');
		expect(getPunchConfig('lent').title).toBe('MONEY AWAY');
		expect(getPunchConfig('borrowed').title).toBe('MONEY COMMITTED');
		expect(getPunchConfig('repaid').title).toBe('MONEY COMMITTED');
	});
});
