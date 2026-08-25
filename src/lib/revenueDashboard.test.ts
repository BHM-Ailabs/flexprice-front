import { describe, expect, it } from 'vitest';
import { INVOICE_STATUS, type Invoice } from '@/models/Invoice';
import { buildInvoiceCollectionSummaries, formatRevenueCurrency } from './revenueDashboard';

const invoice = (overrides: Partial<Invoice>): Invoice =>
	({
		id: 'invoice-default',
		invoice_status: INVOICE_STATUS.FINALIZED,
		currency: 'ngn',
		amount_due: 1000,
		amount_paid: 400,
		amount_remaining: 600,
		due_date: '2026-08-01T00:00:00.000Z',
		...overrides,
	}) as Invoice;

describe('buildInvoiceCollectionSummaries', () => {
	it('keeps currencies separate and excludes non-finalized invoices', () => {
		const summaries = buildInvoiceCollectionSummaries(
			[
				invoice({ id: 'ngn-overdue' }),
				invoice({ id: 'ngn-paid', amount_due: 500, amount_paid: 500, amount_remaining: 0 }),
				invoice({
					id: 'usd-open',
					currency: 'usd',
					amount_due: 20,
					amount_paid: 5,
					amount_remaining: 15,
					due_date: '2026-09-01T00:00:00.000Z',
				}),
				invoice({ id: 'draft', invoice_status: INVOICE_STATUS.DRAFT, amount_due: 99999 }),
			],
			new Date('2026-08-25T00:00:00.000Z'),
		);

		expect(summaries).toEqual([
			{
				currency: 'ngn',
				invoiced: 1500,
				collected: 900,
				outstanding: 600,
				overdue: 600,
				invoiceCount: 2,
				paidInvoiceCount: 1,
				overdueInvoiceCount: 1,
			},
			{
				currency: 'usd',
				invoiced: 20,
				collected: 5,
				outstanding: 15,
				overdue: 0,
				invoiceCount: 1,
				paidInvoiceCount: 0,
				overdueInvoiceCount: 0,
			},
		]);
	});
});

describe('formatRevenueCurrency', () => {
	it('uses the supplied currency instead of assuming dollars', () => {
		expect(formatRevenueCurrency(1500, 'NGN')).toContain('1,500');
		expect(formatRevenueCurrency(1500, 'NGN')).not.toContain('$');
	});
});
