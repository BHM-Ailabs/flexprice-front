import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Invoice } from '@/models/Invoice';
vi.mock('@/components/atoms', () => ({
	Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
	Chip: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('@/components/molecules', () => ({ InvoiceDownloadFormatDialog: () => null }));
vi.mock('@/components/ui', () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock('@/context/PortalConfigContext', () => ({ usePortalConfig: () => ({ config: {} }) }));
vi.mock('@/api/CustomerPortalApi', () => ({ default: { getInvoices: vi.fn(), downloadInvoicePdf: vi.fn() } }));
import CustomerPortalApi from '@/api/CustomerPortalApi';
import InvoicesTab from './InvoicesTab';
import InvoicesWidget from './widgets/InvoicesWidget';

const entry = (reference: string) =>
	({
		id: `inv_${reference}`,
		public_reference: reference,
		invoice_number: `OLD-${reference}`,
		total: 10,
		currency: 'USD',
		invoice_status: 'FINALIZED',
		payment_status: 'SUCCEEDED',
		created_at: '2026-09-11T00:00:00Z',
	}) as Invoice;
beforeEach(() => vi.clearAllMocks());
describe.each([
	['portal tab', InvoicesTab],
	['portal widget', InvoicesWidget],
] as const)('%s server invoice search', (_name, Component) => {
	const mount = () =>
		render(
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<Component />
			</QueryClientProvider>,
		);
	it('finds an older invoice by an old alias and keeps its canonical display, using server results instead of filtering the first batch', async () => {
		vi.mocked(CustomerPortalApi.getInvoices).mockImplementation(async ({ search }) => ({
			items: search === 'INV-2020-OLD' ? [entry('8K4M2P')] : [entry('NEW123')],
			pagination: { total: search ? 1 : 101 },
		}));
		mount();
		await screen.findByText('NEW123');
		fireEvent.change(screen.getByLabelText('Search invoices'), { target: { value: 'INV-2020-OLD' } });
		await screen.findByText('8K4M2P');
		expect(CustomerPortalApi.getInvoices).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'INV-2020-OLD' });
		expect(screen.queryByText('OLD-8K4M2P')).toBeNull();
	});
	it('pages beyond the first 100 invoices and resets pagination when searching', async () => {
		vi.mocked(CustomerPortalApi.getInvoices).mockImplementation(async ({ page, search }) => ({
			items: [entry(search ? 'MATCH1' : `PAGE${page}`)],
			pagination: { total: search ? 1 : 101 },
		}));
		mount();
		for (let page = 1; page <= 4; page++) {
			await screen.findByText(`PAGE${page}`);
			fireEvent.click(screen.getByRole('button', { name: 'Next invoices' }));
		}
		await screen.findByText('PAGE5');
		expect(CustomerPortalApi.getInvoices).toHaveBeenLastCalledWith({ page: 5, limit: 25 });
		expect(screen.getByRole('button', { name: 'Next invoices' })).toBeDisabled();
		fireEvent.change(screen.getByLabelText('Search invoices'), { target: { value: 'MATCH1' } });
		await screen.findByText('MATCH1');
		expect(CustomerPortalApi.getInvoices).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: 'MATCH1' });
	});
	it('keeps search available after no matches and reports server failures without another endpoint fallback', async () => {
		vi.mocked(CustomerPortalApi.getInvoices).mockResolvedValue({ items: [], pagination: { total: 0 } });
		mount();
		await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
		vi.mocked(CustomerPortalApi.getInvoices).mockRejectedValue(new Error('Denied'));
		fireEvent.change(screen.getByLabelText('Search invoices'), { target: { value: '8K4M2P' } });
		await screen.findByRole('alert');
		expect(screen.getByLabelText('Search invoices')).toHaveValue('8K4M2P');
		expect(CustomerPortalApi.getInvoices).toHaveBeenLastCalledWith({ page: 1, limit: 25, search: '8K4M2P' });
	});
});
