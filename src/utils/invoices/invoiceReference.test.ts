import { describe, expect, it, vi } from 'vitest';
import type { Invoice } from '@/models/Invoice';
import { deserializeFilters } from '@/utils/filterPersistence';
import { invoiceReference, invoiceSearchHref, prepaidInvoiceReference } from './invoiceReference';
import { downloadInvoiceLineItemsCsv } from './downloadInvoiceLineItemsCsv';

describe('canonical invoice references', () => {
	it('uses the same public reference for native and Account projections without changing old numbers', () => {
		const native = { public_reference: '8K4M2P', invoice_number: 'INV-202609-00001' };
		expect(invoiceReference(native)).toBe('8K4M2P');
		expect(prepaidInvoiceReference({ publicReference: '8K4M2P', invoiceNumber: 'PLQ-INV-OLD' })).toBe('8K4M2P');
		expect(native.invoice_number).toBe('INV-202609-00001');
	});
	it('retains old API and other-tenant numbers but never invents or exposes a number for an unresolved reference', () => {
		expect(invoiceReference({ invoice_number: 'ACME-123' })).toBe('ACME-123');
		expect(invoiceReference({ public_reference: null, invoice_number: 'INV-OLD' })).toBe('Number pending');
		expect(prepaidInvoiceReference({ publicReference: null, invoiceNumber: 'PLQ-OLD' })).toBe('Number pending');
		expect(invoiceReference({})).toBe('Number pending');
	});
	it('carries a reference to an alias-aware invoice search without Revenue date, currency or status restrictions', () => {
		const url = new URL(invoiceSearchHref(' OLD/ref?=123 '), 'https://bsp.example.test');
		expect(url.pathname).toBe('/billing/invoices');
		expect([...url.searchParams.keys()]).toEqual(['fetchInvoices_filters']);
		expect(deserializeFilters(url.searchParams.get('fetchInvoices_filters'))).toMatchObject([
			{ field: 'invoice_reference', operator: 'contains', valueString: 'OLD/ref?=123' },
		]);
	});
	it('exports the canonical reference in the filename while retaining invoice data and IDs', () => {
		const originalCreate = URL.createObjectURL;
		const originalRevoke = URL.revokeObjectURL;
		URL.createObjectURL = vi.fn(() => 'blob:csv');
		URL.revokeObjectURL = vi.fn();
		let filename = '';
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			filename = this.download;
		});
		const invoice = {
			id: 'inv_internal',
			public_reference: '8K4M2P',
			invoice_number: 'INV-OLD',
			invoice_type: 'ONE_OFF',
			line_items: [{ display_name: 'Credits', amount: 10, quantity: '1', currency: 'USD' }],
		} as Invoice;
		try {
			expect(downloadInvoiceLineItemsCsv(invoice)).toBe(1);
			expect(filename).toBe('invoice-8K4M2P.csv');
			expect(invoice.id).toBe('inv_internal');
			expect(invoice.invoice_number).toBe('INV-OLD');
		} finally {
			click.mockRestore();
			URL.createObjectURL = originalCreate;
			URL.revokeObjectURL = originalRevoke;
		}
	});
});
