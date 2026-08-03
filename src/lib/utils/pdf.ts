import { formatCurrency } from '$lib/utils/format';
import type { Transaction } from '$lib/types';

export interface PdfFilters {
	type?: string;
	category?: string;
	dateFrom?: string;
	dateTo?: string;
}

/* ─────────────────────────────────────────────────────────────
   GENERATE TRANSACTION PDF (used on Transactions page)
   ───────────────────────────────────────────────────────────── */

export async function generateTransactionPdf(
	transactions: Transaction[],
	filters: PdfFilters,
	summary: { totalIncome: number; totalExpenses: number; net: number; count: number }
) {
	const { default: jsPDF } = await import('jspdf');
	const autoTableModule = await import('jspdf-autotable');
	const autoTable = autoTableModule.autoTable || autoTableModule.default;

	const doc = new jsPDF('portrait', 'mm', 'a4');
	const pw = doc.internal.pageSize.getWidth();
	const ph = doc.internal.pageSize.getHeight();
	const m = 20;

	const teal = [43, 168, 162] as const;
	const gold = [255, 210, 63] as const;
	const coral = [239, 108, 74] as const;
	const ink = [20, 48, 46] as const;
	const muted = [92, 122, 120] as const;
	const borderC = [229, 231, 235] as const;

	let y = m;

	// ─── Header: teal band with wordmark + gold rule ─────────────
	doc.setFillColor(...teal);
	doc.rect(0, 0, pw, 28, 'F');

	doc.setFontSize(16);
	doc.setTextColor(255, 255, 255);
	doc.text('Trackr', m, 18);

	doc.setDrawColor(...gold);
	doc.setLineWidth(1.5);
	doc.line(m, 26, pw - m, 26);

	y = 38;

	doc.setFontSize(12);
	doc.setTextColor(...ink);
	doc.text('Transaction Statement', m, y);
	y += 10;

	const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	doc.setFontSize(8);
	doc.setTextColor(...muted);
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
	doc.setDrawColor(...borderC);
	doc.setLineWidth(0.3);
	doc.line(m, y, pw - m, y);
	y += 8;

	// ─── Summary box (top-right) ─────────────────────────────────
	const boxX = pw - m - 100;
	const boxW = 100;
	const boxH = 28;
	doc.setFillColor(249, 250, 251);
	doc.roundedRect(boxX, y - 4, boxW, boxH, 3, 3, 'F');
	doc.setDrawColor(...borderC);
	doc.roundedRect(boxX, y - 4, boxW, boxH, 3, 3, 'S');

	const labelX = boxX + 10;
	let ly = y;
	const rowH2 = 7;

	doc.setFontSize(7);
	doc.setTextColor(...muted);
	doc.text('Total Income', labelX, ly);
	doc.setFontSize(9);
	doc.setTextColor(...teal);
	doc.text(formatCurrency(summary.totalIncome), boxX + boxW - 12, ly, { align: 'right' });
	ly += rowH2;

	doc.setFontSize(7);
	doc.setTextColor(...muted);
	doc.text('Total Expenses', labelX, ly);
	doc.setFontSize(9);
	doc.setTextColor(...ink);
	doc.text(formatCurrency(summary.totalExpenses), boxX + boxW - 12, ly, { align: 'right' });
	ly += rowH2;

	doc.setFontSize(7);
	doc.setTextColor(...muted);
	doc.text('Net Balance', labelX, ly);
	doc.setFontSize(9);
	const netColor: readonly [number, number, number] = summary.net >= 0 ? teal : coral;
	doc.setTextColor(...netColor);
	doc.text(
		formatCurrency(Math.abs(summary.net)),
		boxX + boxW - 12,
		ly,
		{ align: 'right' }
	);

	y += boxH + 8;

	// ─── Transaction table ───────────────────────────────────────
	const tableData = transactions.map((t) => [
		new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
		t.description || '—',
		t.category_name || '—',
		formatCurrency(t.amount),
	]);

	autoTable(doc, {
		startY: y,
		head: [['Date', 'Description', 'Category', 'Amount']],
		body: tableData,
		theme: 'plain',
		margin: { left: m, right: m },
		tableWidth: pw - m * 2,
		headStyles: {
			fontSize: 7,
			fontStyle: 'bold',
			textColor: [...muted],
			fillColor: [255, 255, 255],
			cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
			lineColor: [...borderC],
			lineWidth: 0.5,
		},
		bodyStyles: {
			fontSize: 8,
			textColor: [...ink],
			cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
			lineColor: [...borderC],
			lineWidth: 0.2,
		},
		alternateRowStyles: {
			fillColor: [249, 250, 251],
		},
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
					data.cell.styles.textColor = [...teal];
				} else if (raw && raw.type === 'expense') {
					data.cell.styles.textColor = [...coral];
				}
			}
		},
		didDrawPage() {
			const count = doc.getNumberOfPages();
			const page = doc.getCurrentPageInfo().pageNumber;

			doc.setFontSize(7);
			doc.setTextColor(...muted);
			doc.text('Generated by Trackr', m, ph - 10);
			doc.text(`Page ${page} of ${count}`, pw - m, ph - 10, { align: 'right' });

			doc.setDrawColor(...borderC);
			doc.setLineWidth(0.3);
			doc.line(m, ph - 14, pw - m, ph - 14);
		},
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
	const { default: jsPDF } = await import('jspdf');
	const autoTableModule = await import('jspdf-autotable');
	const autoTable = autoTableModule.autoTable || autoTableModule.default;

	const doc = new jsPDF('portrait', 'mm', 'a4');
	const pw = doc.internal.pageSize.getWidth();
	const ph = doc.internal.pageSize.getHeight();
	const m = 20;
	const cw = pw - m * 2;

	const teal = [43, 168, 162] as const;
	const gold = [255, 210, 63] as const;
	const coral = [239, 108, 74] as const;
	const ink = [20, 48, 46] as const;
	const muted = [92, 122, 120] as const;
	const borderC = [229, 231, 235] as const;

	let y = m;

	// ─── Header: teal band with wordmark + gold rule ─────────────
	doc.setFillColor(...teal);
	doc.rect(0, 0, pw, 28, 'F');

	doc.setFontSize(16);
	doc.setTextColor(255, 255, 255);
	doc.text('Trackr', m, 18);

	doc.setDrawColor(...gold);
	doc.setLineWidth(1.5);
	doc.line(m, 26, pw - m, 26);

	y = 38;

	doc.setFontSize(14);
	doc.setTextColor(...ink);
	doc.text('Monthly Financial Report', m, y);
	y += 6;

	doc.setFontSize(10);
	doc.setTextColor(...muted);
	doc.text(periodLabel, m, y);
	y += 4;

	const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	doc.setFontSize(8);
	doc.setTextColor(...muted);
	doc.text(`Generated ${dateStr}  ·  ${summary.count} transactions`, m, y);
	y += 10;

	doc.setDrawColor(...gold);
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
		{ label: 'Total Income', value: formatCurrency(summary.totalIncome), color: teal, bg: [236, 253, 245] as const },
		{ label: 'Total Expenses', value: formatCurrency(summary.totalExpenses), color: ink, bg: [254, 242, 242] as const },
		{ label: 'Net Cash Flow', value: formatCurrency(Math.abs(summary.net)), color: summary.net >= 0 ? teal : coral, bg: [239, 246, 255] as const },
	];

	boxes.forEach((box, i) => {
		const bx = m + i * (boxW + boxGap);

		doc.setFillColor(...box.bg);
		doc.roundedRect(bx, y, boxW, boxH, 4, 4, 'F');

		doc.setFontSize(7);
		doc.setTextColor(...muted);
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
		doc.setTextColor(...ink);
		doc.setFont('Helvetica', 'bold');
		doc.text('Top Spending Categories', m, y);
		doc.setFont('Helvetica', 'normal');
		y += 6;

		topCategories.slice(0, 3).forEach((cat) => {
			const pct = summary.totalExpenses > 0
				? ((cat.total / summary.totalExpenses) * 100).toFixed(1)
				: '0';

			doc.setFillColor(...teal);
			doc.circle(m + 3, y - 1.5, 1.5, 'F');

			doc.setFontSize(8);
			doc.setTextColor(...ink);
			doc.text(cat.name || 'Other', m + 8, y);

			doc.setTextColor(...muted);
			doc.text(`${formatCurrency(cat.total)} (${pct}%)`, pw - m, y, { align: 'right' });
			y += 5;
		});
		y += 4;

		doc.setDrawColor(...borderC);
		doc.setLineWidth(0.3);
		doc.line(m, y, pw - m, y);
		y += 6;
	}

	// ─── Transaction table ──────────────────────────────────────
	const tableData = transactions.map((t) => [
		new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
		t.description || '—',
		t.category_name || '—',
		formatCurrency(t.amount),
	]);

	autoTable(doc, {
		startY: y,
		head: [['Date', 'Description', 'Category', 'Amount']],
		body: tableData,
		theme: 'plain',
		margin: { left: m, right: m },
		tableWidth: cw,
		headStyles: {
			fontSize: 7,
			fontStyle: 'bold',
			textColor: [...muted],
			fillColor: [255, 255, 255],
			cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
			lineColor: [...borderC],
			lineWidth: 0.5,
		},
		bodyStyles: {
			fontSize: 8,
			textColor: [...ink],
			cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
			lineColor: [...borderC],
			lineWidth: 0.2,
		},
		alternateRowStyles: {
			fillColor: [249, 250, 251],
		},
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
					data.cell.styles.textColor = [...teal];
				} else if (raw && raw.type === 'expense') {
					data.cell.styles.textColor = [...coral];
				}
			}
		},
		didDrawPage() {
			const count = doc.getNumberOfPages();
			const page = doc.getCurrentPageInfo().pageNumber;

			doc.setFontSize(7);
			doc.setTextColor(...muted);
			doc.text('Generated by Trackr · Monthly Financial Report', m, ph - 10);
			doc.text(`Page ${page} of ${count}`, pw - m, ph - 10, { align: 'right' });

			doc.setDrawColor(...borderC);
			doc.setLineWidth(0.3);
			doc.line(m, ph - 14, pw - m, ph - 14);
		},
	});

	return doc;
}
