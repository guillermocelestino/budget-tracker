import { formatCurrency, formatPlainAmount } from '$lib/client/utils/format';
import { formatDateShort } from '$lib/shared/utils/format';
import type { jsPDF } from 'jspdf';
import type { Transaction, Lending } from '$lib/types';

export interface PdfFilters {
	type?: string;
	category?: string;
	dateFrom?: string;
	dateTo?: string;
}

/* ─────────────────────────────────────────────────────────────
   SHARED PDF BUILDING BLOCKS (Flip7 theme)
   ───────────────────────────────────────────────────────────── */

const COLORS = {
	black: [0, 0, 0] as const,
	teal: [43, 168, 162] as const,
	gold: [255, 210, 63] as const,
	coral: [239, 108, 74] as const,
	ink: [20, 48, 46] as const,
	muted: [92, 122, 120] as const,
	borderC: [229, 231, 235] as const,
	band: [249, 250, 251] as const,
};

const M = 20;

/** Lazily load jsPDF + jspdf-autotable and create a portrait A4 document. */
async function createPdfDocument() {
	const { default: jsPDF } = await import('jspdf');
	const autoTableModule = await import('jspdf-autotable');
	const autoTable = autoTableModule.autoTable || autoTableModule.default;

	const doc = new jsPDF('portrait', 'mm', 'a4');
	const pw = doc.internal.pageSize.getWidth();
	const ph = doc.internal.pageSize.getHeight();
	return { doc, autoTable, pw, ph, m: M };
}

/** Flip7 header band: teal fill, wordmark, gold rule. */
function drawHeaderBand(doc: jsPDF, pw: number, m: number) {
	doc.setFillColor(...COLORS.teal);
	doc.rect(0, 0, pw, 28, 'F');

	doc.setFontSize(16);
	doc.setTextColor(255, 255, 255);
	doc.text('Trackr', m, 18);

	doc.setDrawColor(...COLORS.gold);
	doc.setLineWidth(1.5);
	doc.line(m, 26, pw - m, 26);
}

/** autoTable `didDrawPage` callback: footer rule + page numbers. */
function pageFooter(doc: jsPDF, pw: number, ph: number, m: number, label: string) {
	return () => {
		const count = doc.getNumberOfPages();
		const page = doc.getCurrentPageInfo().pageNumber;

		doc.setFontSize(7);
		doc.setTextColor(...COLORS.muted);
		doc.text(label, m, ph - 10);
		doc.text(`Page ${page} of ${count}`, pw - m, ph - 10, { align: 'right' });

		doc.setDrawColor(...COLORS.borderC);
		doc.setLineWidth(0.3);
		doc.line(m, ph - 14, pw - m, ph - 14);
	};
}

interface SummaryRow {
	label: string;
	value: string;
}

/**
 * Full-width summary strip: labels left, values right, even row spacing.
 * Returns the y coordinate to continue drawing from (box bottom + 8).
 */
function drawSummaryStrip(
	doc: jsPDF,
	pw: number,
	m: number,
	y: number,
	rows: SummaryRow[]
): number {
	const rowH = 9;
	const boxH = (rows.length - 1) * rowH + 12; // 6mm top + 6mm bottom padding
	const padX = 14;

	doc.setFillColor(...COLORS.band);
	doc.roundedRect(m, y - 6, pw - m * 2, boxH, 3, 3, 'F');
	doc.setDrawColor(...COLORS.borderC);
	doc.roundedRect(m, y - 6, pw - m * 2, boxH, 3, 3, 'S');

	const labelX = m + padX;
	const valueX = pw - m - padX;
	let ly = y;
	for (const row of rows) {
		doc.setFontSize(8);
		doc.setTextColor(...COLORS.muted);
		doc.text(row.label, labelX, ly);
		doc.setFontSize(10);
		doc.setTextColor(...COLORS.black);
		doc.text(row.value, valueX, ly, { align: 'right' });
		ly += rowH;
	}
	return y + boxH + 8;
}

interface PdfTableOptions {
	startY: number;
	width: number;
	head: string[][];
	body: string[][];
	columnStyles?: Record<number, { cellWidth?: number | 'auto'; halign?: 'left' | 'center' | 'right' }>;
	didParseCell?: (data: {
		cell: { styles: { textColor?: unknown } };
		row: { index: number };
		column: { index: number };
	}) => void;
	footerLabel: string;
}

/** Flip7 table: plain theme, bordered header, zebra rows, page footer. */
function renderPdfTable(
	doc: jsPDF,
	autoTable: Awaited<ReturnType<typeof createPdfDocument>>['autoTable'],
	pw: number,
	ph: number,
	m: number,
	opts: PdfTableOptions
) {
	autoTable(doc, {
		startY: opts.startY,
		head: opts.head,
		body: opts.body,
		theme: 'plain',
		margin: { left: m, right: m },
		tableWidth: opts.width,
		headStyles: {
			fontSize: 7,
			fontStyle: 'bold',
			textColor: [...COLORS.muted],
			fillColor: [255, 255, 255],
			cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
			lineColor: [...COLORS.borderC],
			lineWidth: 0.5,
		},
		bodyStyles: {
			fontSize: 8,
			textColor: [...COLORS.ink],
			cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
			lineColor: [...COLORS.borderC],
			lineWidth: 0.2,
		},
		alternateRowStyles: {
			fillColor: [249, 250, 251],
		},
		columnStyles: opts.columnStyles,
		didParseCell: opts.didParseCell,
		didDrawPage: pageFooter(doc, pw, ph, m, opts.footerLabel),
	});
}

/* ─────────────────────────────────────────────────────────────
   GENERATE TRANSACTION PDF (used on Transactions page)
   ───────────────────────────────────────────────────────────── */

export async function generateTransactionPdf(
	transactions: Transaction[],
	filters: PdfFilters,
	summary: { totalIncome: number; totalExpenses: number; net: number; count: number }
) {
	const { doc, autoTable, pw, ph, m } = await createPdfDocument();
	drawHeaderBand(doc, pw, m);

	let y = 38;

	doc.setFontSize(12);
	doc.setTextColor(...COLORS.ink);
	doc.text('Transaction Statement', m, y);
	y += 10;

	const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	doc.setFontSize(8);
	doc.setTextColor(...COLORS.muted);
	doc.text(`Generated ${dateStr}`, m, y);
	if (filters.dateFrom) {
		const period = `${filters.dateFrom} – ${filters.dateTo || 'Present'}`;
		doc.text(`Period: ${period}`, m + 55, y);
	}
	y += 8;

	const filterParts: string[] = [];
	if (filters.type) filterParts.push(`Type: ${filters.type}`);
	if (filters.category) filterParts.push(`Category: ${filters.category}`);
	if (filterParts.length > 0) {
		doc.text(filterParts.join('  ·  '), m, y);
		y += 2;
	}
	doc.setDrawColor(...COLORS.borderC);
	doc.setLineWidth(0.3);
	doc.line(m, y, pw - m, y);
	y += 8;

	y = drawSummaryStrip(doc, pw, m, y, [
		{ label: 'Total Income', value: formatPlainAmount(summary.totalIncome) },
		{ label: 'Total Expenses', value: formatPlainAmount(summary.totalExpenses) },
		{ label: 'Net Balance', value: formatPlainAmount(summary.net) },
	]);

	const tableData = transactions.map((t) => [
		formatDateShort(t.date),
		t.description || '—',
		t.category_name || '—',
		formatPlainAmount(t.amount),
	]);

	renderPdfTable(doc, autoTable, pw, ph, m, {
		startY: y,
		width: pw - m * 2,
		head: [['Date', 'Description', 'Category', 'Amount']],
		body: tableData,
		columnStyles: {
			0: { cellWidth: 28 },
			1: { cellWidth: 'auto' },
			2: { cellWidth: 32 },
			3: { cellWidth: 38, halign: 'right' },
		},
		didParseCell(data) {
			if (data.column.index === 3) {
				data.cell.styles.textColor = [...COLORS.black];
			}
		},
		footerLabel: 'Generated by Trackr',
	});

	return doc;
}

/* ─────────────────────────────────────────────────────────────
   GENERATE REPORT PDF (used on Reports page)
   ───────────────────────────────────────────────────────────── */

export async function generateReportPdf(
	summary: { totalIncome: number; totalExpenses: number; net: number; count: number },
	transactions: Transaction[],
	periodLabel: string,
	topCategories?: Array<{ name: string; total: number; color: string }>
) {
	const { doc, autoTable, pw, ph, m } = await createPdfDocument();
	const cw = pw - m * 2;
	drawHeaderBand(doc, pw, m);

	let y = 38;

	doc.setFontSize(14);
	doc.setTextColor(...COLORS.ink);
	doc.text('Monthly Financial Report', m, y);
	y += 6;

	doc.setFontSize(10);
	doc.setTextColor(...COLORS.muted);
	doc.text(periodLabel, m, y);
	y += 4;

	const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	doc.setFontSize(8);
	doc.setTextColor(...COLORS.muted);
	doc.text(`Generated ${dateStr}  ·  ${summary.count} transactions`, m, y);
	y += 10;

	doc.setDrawColor(...COLORS.gold);
	doc.setLineWidth(0.5);
	doc.line(m, y, pw - m, y);
	y += 8;

	// ─── Three summary boxes (side-by-side) ─────────────────────
	const boxW = (cw - 16) / 3;
	const boxH = 36;
	const boxGap = 8;

	const boxes: Array<{
		label: string;
		value: string;
		color: readonly [number, number, number];
		bg: readonly [number, number, number];
	}> = [
		{ label: 'Total Income', value: formatCurrency(summary.totalIncome), color: COLORS.teal, bg: [236, 253, 245] as const },
		{ label: 'Total Expenses', value: formatCurrency(summary.totalExpenses), color: COLORS.ink, bg: [254, 242, 242] as const },
		{ label: 'Net Cash Flow', value: formatCurrency(Math.abs(summary.net)), color: summary.net >= 0 ? COLORS.teal : COLORS.coral, bg: [239, 246, 255] as const },
	];

	boxes.forEach((box, i) => {
		const bx = m + i * (boxW + boxGap);

		doc.setFillColor(...box.bg);
		doc.roundedRect(bx, y, boxW, boxH, 4, 4, 'F');

		doc.setFontSize(7);
		doc.setTextColor(...COLORS.muted);
		doc.text(box.label, bx + boxW / 2, y + 11, { align: 'center' });

		doc.setFontSize(12);
		doc.setFont('Helvetica', 'bold');
		doc.setTextColor(...box.color);
		doc.text(box.value, bx + boxW / 2, y + 27, { align: 'center' });
		doc.setFont('Helvetica', 'normal');
	});

	y += boxH + 10;

	// ─── Top categories ──────────────────────────────────────────
	if (topCategories && topCategories.length > 0) {
		doc.setFontSize(9);
		doc.setTextColor(...COLORS.ink);
		doc.setFont('Helvetica', 'bold');
		doc.text('Top Spending Categories', m, y);
		doc.setFont('Helvetica', 'normal');
		y += 6;

		topCategories.slice(0, 3).forEach((cat) => {
			const pct = summary.totalExpenses > 0
				? ((cat.total / summary.totalExpenses) * 100).toFixed(1)
				: '0';

			doc.setFillColor(...COLORS.teal);
			doc.circle(m + 3, y - 1.5, 1.5, 'F');

			doc.setFontSize(8);
			doc.setTextColor(...COLORS.ink);
			doc.text(cat.name || 'Other', m + 8, y);

			doc.setTextColor(...COLORS.muted);
			doc.text(`${formatCurrency(cat.total)} (${pct}%)`, pw - m, y, { align: 'right' });
			y += 5;
		});
		y += 4;

		doc.setDrawColor(...COLORS.borderC);
		doc.setLineWidth(0.3);
		doc.line(m, y, pw - m, y);
		y += 6;
	}

	const tableData = transactions.map((t) => [
		formatDateShort(t.date),
		t.description || '—',
		t.category_name || '—',
		formatCurrency(t.amount),
	]);

	renderPdfTable(doc, autoTable, pw, ph, m, {
		startY: y,
		width: cw,
		head: [['Date', 'Description', 'Category', 'Amount']],
		body: tableData,
		columnStyles: {
			0: { cellWidth: 28 },
			1: { cellWidth: 'auto' },
			2: { cellWidth: 32 },
			3: { cellWidth: 38, halign: 'right' },
		},
		didParseCell(data) {
			if (data.column.index === 3) {
				const raw = transactions[data.row.index];
				if (raw && raw.type === 'income') {
					data.cell.styles.textColor = [...COLORS.teal];
				} else if (raw && raw.type === 'expense') {
					data.cell.styles.textColor = [...COLORS.coral];
				}
			}
		},
		footerLabel: 'Generated by Trackr · Monthly Financial Report',
	});

	return doc;
}

/* ─────────────────────────────────────────────────────────────
   GENERATE LENDING / BORROWED PDF (used on Lending & Borrowed pages)
   ───────────────────────────────────────────────────────────── */

type LendingDirection = 'lent' | 'borrowed';

/** Summary derived from the (already filtered) records being exported. */
function computeLendingSummary(lendings: Lending[]) {
	const total = lendings.reduce((s, l) => s + l.amount, 0);
	const recovered = lendings
		.filter((l) => l.status === 'paid')
		.reduce((s, l) => s + l.amount, 0);
	return {
		total,
		recovered,
		outstanding: total - recovered,
		count: lendings.length,
	};
}

async function generateLendingPdfCore(lendings: Lending[], direction: LendingDirection) {
	const isBorrowed = direction === 'borrowed';
	const { doc, autoTable, pw, ph, m } = await createPdfDocument();
	drawHeaderBand(doc, pw, m);

	let y = 38;

	doc.setFontSize(12);
	doc.setTextColor(...COLORS.ink);
	doc.text(isBorrowed ? 'Borrowing Statement' : 'Lending Statement', m, y);
	y += 10;

	const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	doc.setFontSize(8);
	doc.setTextColor(...COLORS.muted);
	doc.text(`Generated ${dateStr}`, m, y);
	y += 8;

	doc.setDrawColor(...COLORS.borderC);
	doc.setLineWidth(0.3);
	doc.line(m, y, pw - m, y);
	y += 8;

	const s = computeLendingSummary(lendings);
	const fmt = (n: number) => formatPlainAmount(n);
	const summaryRows: SummaryRow[] = isBorrowed
		? [
			{ label: 'Total Borrowed', value: fmt(s.total) },
			{ label: 'Total Repaid', value: fmt(s.recovered) },
			{ label: 'Remaining Balance', value: fmt(s.outstanding) },
			{ label: 'Number of Loans', value: s.count.toLocaleString('en-US') },
		]
		: [
			{ label: 'Total Lent', value: fmt(s.total) },
			{ label: 'Total Recovered', value: fmt(s.recovered) },
			{ label: 'Outstanding Balance', value: fmt(s.outstanding) },
			{ label: 'Number of Loans', value: s.count.toLocaleString('en-US') },
		];

	y = drawSummaryStrip(doc, pw, m, y, summaryRows);

	const personLabel = isBorrowed ? 'Lender' : 'Borrower';
	const amountLabel = isBorrowed ? 'Amount Borrowed' : 'Amount Lent';
	const repaidLabel = isBorrowed ? 'Repaid' : 'Recovered';
	const balanceLabel = isBorrowed ? 'Remaining Balance' : 'Outstanding';

	const tableData = lendings.map((l) => [
		l.borrower_name,
		fmt(l.amount),
		l.status === 'paid' ? fmt(l.amount) : fmt(0),
		l.status === 'paid' ? fmt(0) : fmt(l.amount),
		l.due_date ? formatDateShort(l.due_date) : '—',
		l.status === 'paid' ? 'Paid' : 'Active',
		l.notes || '—',
	]);

	renderPdfTable(doc, autoTable, pw, ph, m, {
		startY: y,
		width: pw - m * 2,
		head: [[personLabel, amountLabel, repaidLabel, balanceLabel, 'Due Date', 'Status', 'Notes']],
		body: tableData,
		columnStyles: {
			0: { cellWidth: 28 },
			1: { cellWidth: 22, halign: 'right' },
			2: { cellWidth: 22, halign: 'right' },
			3: { cellWidth: 30, halign: 'right' },
			4: { cellWidth: 20 },
			5: { cellWidth: 15 },
			6: { cellWidth: 'auto' },
		},
		didParseCell(data) {
			if (data.column.index >= 1 && data.column.index <= 3) {
				data.cell.styles.textColor = [...COLORS.black];
			}
		},
		footerLabel: isBorrowed
			? 'Generated by Trackr · Borrowing Statement'
			: 'Generated by Trackr · Lending Statement',
	});

	return doc;
}

export function generateLendingPdf(lendings: Lending[]) {
	return generateLendingPdfCore(lendings, 'lent');
}

export function generateBorrowedPdf(lendings: Lending[]) {
	return generateLendingPdfCore(lendings, 'borrowed');
}
