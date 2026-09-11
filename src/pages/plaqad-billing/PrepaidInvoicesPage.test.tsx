import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
vi.mock('@/components/atoms', () => ({
	Page: ({ children, heading }: { children: React.ReactNode; heading: string }) => (
		<main>
			<h1>{heading}</h1>
			{children}
		</main>
	),
	Button: ({
		children,
		isLoading,
		variant: _variant,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean; variant?: string }) => (
		<button {...props} disabled={props.disabled || isLoading}>
			{children}
		</button>
	),
	Dialog: ({ children, isOpen, title }: { children: React.ReactNode; isOpen: boolean; title: string }) =>
		isOpen ? (
			<div role='dialog' aria-label={title}>
				{children}
			</div>
		) : null,
}));
vi.mock('@/api/PlaqadBillingApi', () => ({ billingGet: vi.fn(), billingPost: vi.fn(), downloadInvoice: vi.fn(), invoicePlans: vi.fn() }));
import { billingGet, billingPost, type PrepaidInvoice } from '@/api/PlaqadBillingApi';
import PrepaidInvoicesPage from './PrepaidInvoicesPage';

const fixture: PrepaidInvoice = {
	id: 'inv-test',
	invoiceNumber: 'PLQ-001',
	recipientEmail: 'customer@example.com',
	recipientName: 'Customer',
	kind: 'credits',
	credits: 25000,
	amountMinor: 33149406,
	currency: 'NGN',
	status: 'draft',
	dueAt: '2026-12-01T00:00:00Z',
	intelPromotion: null,
	expired: false,
	planLookupKey: null,
	planName: null,
	note: null,
	workspaceId: null,
	createdAt: '2026-09-11T12:00:00Z',
	issuedAt: null,
	paidAt: null,
	fulfilledAt: null,
	checkoutState: 'idle',
};
let invoice = { ...fixture };
function mount(path = '/billing/prepaid-invoices') {
	return render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path='/billing/prepaid-invoices/:invoiceId?' element={<PrepaidInvoicesPage />} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}
beforeEach(() => {
	vi.clearAllMocks();
	invoice = { ...fixture };
	vi.mocked(billingGet).mockImplementation(async (path) => (path === '/invoices' ? { invoices: [invoice] } : { invoice }));
	vi.mocked(billingPost).mockResolvedValue({ invoice, claimUrl: 'https://account.plaqad.com/invoices/test' });
});
describe('prepaid invoice operator actions', () => {
	it('opens a saved invoice directly by ID and displays the exact quoted total', async () => {
		mount('/billing/prepaid-invoices/inv-test');
		expect(await screen.findByRole('button', { name: 'Issue invoice' })).toBeTruthy();
		expect(billingGet).toHaveBeenCalledWith('/invoices/inv-test');
		expect(screen.getAllByText('₦331,494.06').length).toBeGreaterThan(0);
		expect(billingPost).not.toHaveBeenCalled();
	});
	it('loads a draft with review and issue actions, without customer sending or side effects', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'PLQ-001' }));
		expect(await screen.findByRole('button', { name: 'Issue invoice' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Send invoice to customer' })).toBeNull();
		expect(billingPost).not.toHaveBeenCalled();
	});
	it('creates an exact credit invoice draft without issuing or emailing it', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Create invoice draft' }));
		const dialog = screen.getByRole('dialog', { name: 'Create prepaid invoice draft' });
		fireEvent.change(within(dialog).getByLabelText('Customer email'), { target: { value: 'customer@example.com' } });
		fireEvent.change(within(dialog).getByLabelText(/^Due date/), {
			target: { value: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16) },
		});
		fireEvent.click(within(dialog).getByLabelText('Use an agreed invoice amount'));
		fireEvent.change(within(dialog).getByLabelText(/^Agreed total/), { target: { value: '331494.06' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save invoice draft' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith(
				'/invoices',
				expect.objectContaining({
					credits: 25000,
					amountMinor: 33149406,
					currency: 'NGN',
					recipientEmail: 'customer@example.com',
					kind: 'credits',
				}),
			),
		);
		expect(billingPost).toHaveBeenCalledTimes(1);
	});
	it('prepares a payment link only for an explicitly selected customer workspace, without emailing', async () => {
		invoice.status = 'issued';
		mount('/billing/prepaid-invoices/inv-test');
		fireEvent.click(await screen.findByRole('button', { name: 'Prepare Paystack link' }));
		const dialog = screen.getByRole('dialog', { name: 'Prepare customer payment link' });
		const workspace = within(dialog).getByLabelText(/^Customer workspace ID/);
		expect(workspace).toHaveValue('');
		expect(within(dialog).getByRole('button', { name: 'Prepare payment link' })).toBeDisabled();
		fireEvent.change(workspace, { target: { value: 'ws_example' } });
		fireEvent.click(within(dialog).getByRole('checkbox'));
		fireEvent.click(within(dialog).getByRole('button', { name: 'Prepare payment link' }));
		await waitFor(() => expect(billingPost).toHaveBeenCalledWith('/invoices/inv-test/prepare-payment', { workspaceId: 'ws_example' }));
		expect(billingPost).toHaveBeenCalledTimes(1);
	});
	it('shows the persisted Paystack and native BSP invoice links without recreating checkout', async () => {
		invoice.status = 'payment_pending';
		invoice.providerInvoiceId = 'inv_provider';
		vi.mocked(billingGet).mockImplementation(async (path) =>
			path === '/invoices' ? { invoices: [invoice] } : { invoice, checkoutUrl: 'https://checkout.paystack.com/test-fixture' },
		);
		mount('/billing/prepaid-invoices/inv-test');
		expect(await screen.findByRole('link', { name: 'https://checkout.paystack.com/test-fixture' })).toHaveAttribute(
			'href',
			'https://checkout.paystack.com/test-fixture',
		);
		expect(screen.getByRole('link', { name: 'View billing provider invoice' })).toHaveAttribute('href', '/billing/invoices/inv_provider');
		expect(screen.queryByRole('button', { name: 'Prepare Paystack link' })).toBeNull();
		expect(billingPost).not.toHaveBeenCalled();
	});
	it('issues only after review and sends no email in that action', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'PLQ-001' }));
		fireEvent.click(await screen.findByRole('button', { name: 'Issue invoice' }));
		const dialog = screen.getByRole('dialog', { name: 'Issue this invoice?' });
		expect(within(dialog).getByRole('button', { name: 'Issue invoice' })).toBeDisabled();
		fireEvent.click(within(dialog).getByRole('checkbox'));
		fireEvent.click(within(dialog).getByRole('button', { name: 'Issue invoice' }));
		await waitFor(() => expect(billingPost).toHaveBeenCalledWith('/invoices/inv-test/issue', {}));
		expect(billingPost).toHaveBeenCalledTimes(1);
	});
	it('sends a review to only named reviewers and blocks the customer address', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'PLQ-001' }));
		fireEvent.click(await screen.findByRole('button', { name: 'Send for review' }));
		const dialog = screen.getByRole('dialog', { name: 'Send invoice for review' });
		fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'customer@example.com' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Send review copy' }));
		await within(dialog).findByRole('alert');
		expect(billingPost).not.toHaveBeenCalled();
		fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'reviewer@example.com' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Send review copy' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith('/invoices/inv-test/send', { audience: 'review', reviewEmails: ['reviewer@example.com'] }),
		);
	});
});
