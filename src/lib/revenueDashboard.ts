import { Invoice, INVOICE_STATUS } from '@/models/Invoice';

export interface InvoiceCollectionSummary {
	currency: string;
	invoiced: number;
	collected: number;
	outstanding: number;
	overdue: number;
	invoiceCount: number;
	paidInvoiceCount: number;
	overdueInvoiceCount: number;
}

const numeric = (value: unknown): number => {
	const parsed = typeof value === 'number' ? value : Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
};

export const buildInvoiceCollectionSummaries = (invoices: Invoice[], now = new Date()): InvoiceCollectionSummary[] => {
	const summaries = new Map<string, InvoiceCollectionSummary>();

	for (const invoice of invoices) {
		if (invoice.invoice_status?.toUpperCase() !== INVOICE_STATUS.FINALIZED) continue;

		const currency = (invoice.currency || 'unknown').toLowerCase();
		const summary = summaries.get(currency) ?? {
			currency,
			invoiced: 0,
			collected: 0,
			outstanding: 0,
			overdue: 0,
			invoiceCount: 0,
			paidInvoiceCount: 0,
			overdueInvoiceCount: 0,
		};
		const amountDue = numeric(invoice.amount_due);
		const amountPaid = numeric(invoice.amount_paid);
		const amountRemaining = Math.max(0, numeric(invoice.amount_remaining));
		const overdue = Boolean(invoice.due_date) && amountRemaining > 0 && new Date(invoice.due_date).getTime() < now.getTime();

		summary.invoiced += amountDue;
		summary.collected += amountPaid;
		summary.outstanding += amountRemaining;
		summary.invoiceCount += 1;
		if (amountRemaining === 0 && amountDue > 0) summary.paidInvoiceCount += 1;
		if (overdue) {
			summary.overdue += amountRemaining;
			summary.overdueInvoiceCount += 1;
		}
		summaries.set(currency, summary);
	}

	return [...summaries.values()].sort((left, right) => left.currency.localeCompare(right.currency));
};

export const formatRevenueCurrency = (value: number | null, currency: string): string => {
	if (value == null) return 'N/A';
	const normalized = currency.toUpperCase();
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: normalized,
			maximumFractionDigits: 2,
		}).format(value);
	} catch {
		return `${normalized} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
	}
};
