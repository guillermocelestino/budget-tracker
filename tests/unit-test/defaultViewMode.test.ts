import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Default View Presentation for Transactions, Lending & Borrowed', () => {
	it('/transactions route defaults to Flat view (showFlatView = true)', () => {
		const pageContent = fs.readFileSync(
			path.resolve(process.cwd(), 'src/routes/transactions/+page.svelte'),
			'utf-8'
		);
		expect(pageContent).toContain('let showFlatView = $state(true);');
	});

	it('/lending route defaults to Table view (viewMode = "table")', () => {
		const pageContent = fs.readFileSync(
			path.resolve(process.cwd(), 'src/routes/lending/+page.svelte'),
			'utf-8'
		);
		expect(pageContent).toContain("let viewMode = $state<'card' | 'table'>('table');");
	});

	it('/borrowed route defaults to Table view (viewMode = "table")', () => {
		const pageContent = fs.readFileSync(
			path.resolve(process.cwd(), 'src/routes/borrowed/+page.svelte'),
			'utf-8'
		);
		expect(pageContent).toContain("let viewMode = $state<'card' | 'table'>('table');");
	});

	it('ViewToggle component defaults showFlatView prop to true', () => {
		const viewToggleContent = fs.readFileSync(
			path.resolve(process.cwd(), 'src/lib/client/components/ViewToggle.svelte'),
			'utf-8'
		);
		expect(viewToggleContent).toContain('showFlatView = true');
	});

	it('TransactionList component defaults showFlatView prop to true', () => {
		const listContent = fs.readFileSync(
			path.resolve(process.cwd(), 'src/lib/client/components/TransactionList.svelte'),
			'utf-8'
		);
		expect(listContent).toContain('showFlatView = true');
	});

	it('ActiveIouList component defaults viewMode prop to "table"', () => {
		const iouListContent = fs.readFileSync(
			path.resolve(process.cwd(), 'src/lib/client/components/ActiveIouList.svelte'),
			'utf-8'
		);
		expect(iouListContent).toContain("viewMode = 'table'");
	});
});
