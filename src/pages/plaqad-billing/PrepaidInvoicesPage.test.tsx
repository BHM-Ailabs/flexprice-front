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
vi.mock('@/api/PlaqadBillingApi', () => ({
	billingGet: vi.fn(),
	billingPost: vi.fn(),
	billingPut: vi.fn(),
	downloadInvoice: vi.fn(),
	invoicePlans: vi.fn(),
}));
import { billingGet, billingPost, billingPut, invoicePlans, type PrepaidInvoice, type PrepaidInvoiceDetail } from '@/api/PlaqadBillingApi';
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
let detailExtra: Partial<PrepaidInvoiceDetail> = {};
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
	detailExtra = {};
	vi.mocked(billingPut).mockResolvedValue({ profile: { displayName: 'Plaqad', website: 'https://plaqad.com' } });
	vi.mocked(billingGet).mockImplementation(async (path) =>
		path === '/invoices'
			? { invoices: [invoice] }
			: path === '/document-profile'
				? { profile: { displayName: 'Plaqad', website: 'https://plaqad.com' } }
				: { invoice, ...detailExtra },
	);
	vi.mocked(billingPost).mockResolvedValue({ invoice, claimUrl: 'https://account.plaqad.com/invoices/test' });
	vi.mocked(invoicePlans).mockResolvedValue([
		{ lookupKey: 'intel-pulse', name: 'Intel Pulse', ctaAction: 'subscribe', availableCurrencies: ['NGN', 'USD'] },
	]);
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
	it.each(['', 'intel-exclusive-14d'])(
		'omits a stale Intel selection after switching to a regular plan (promotional key: %j)',
		async (promotionalKey) => {
			mount();
			fireEvent.click(await screen.findByRole('button', { name: 'Create invoice draft' }));
			const dialog = screen.getByRole('dialog', { name: 'Create prepaid invoice draft' });
			fireEvent.click(within(dialog).getByLabelText('Include 14 days of complimentary Intel'));
			fireEvent.change(within(dialog).getByLabelText('Intel promotional plan lookup key'), { target: { value: promotionalKey } });
			fireEvent.change(within(dialog).getByLabelText('Purchase'), { target: { value: 'plan' } });
			expect(within(dialog).queryByLabelText('Include 14 days of complimentary Intel')).toBeNull();
			expect(within(dialog).queryByLabelText('Intel promotional plan lookup key')).toBeNull();
			await within(dialog).findByRole('option', { name: 'Intel Pulse' });
			fireEvent.change(within(dialog).getByLabelText(/^Plan/), { target: { value: 'intel-pulse' } });
			fireEvent.change(within(dialog).getByLabelText('Customer email'), { target: { value: 'customer@example.com' } });
			fireEvent.change(within(dialog).getByLabelText(/^Due date/), {
				target: { value: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16) },
			});
			fireEvent.click(within(dialog).getByRole('button', { name: 'Save invoice draft' }));
			await waitFor(() => expect(billingPost).toHaveBeenCalledTimes(1));
			const [path, payload] = vi.mocked(billingPost).mock.calls[0];
			expect(path).toBe('/invoices');
			expect(payload).toMatchObject({ kind: 'plan', planLookupKey: 'intel-pulse' });
			expect(payload).not.toHaveProperty('intelPromotion');
			expect(payload).not.toHaveProperty('credits');
		},
	);
	it('retains the optional Intel promotion on a credit invoice', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Create invoice draft' }));
		const dialog = screen.getByRole('dialog', { name: 'Create prepaid invoice draft' });
		fireEvent.click(within(dialog).getByLabelText('Include 14 days of complimentary Intel'));
		fireEvent.change(within(dialog).getByLabelText('Intel promotional plan lookup key'), { target: { value: 'intel-exclusive-14d' } });
		fireEvent.change(within(dialog).getByLabelText('Customer email'), { target: { value: 'customer@example.com' } });
		fireEvent.change(within(dialog).getByLabelText(/^Due date/), {
			target: { value: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 16) },
		});
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save invoice draft' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith(
				'/invoices',
				expect.objectContaining({
					kind: 'credits',
					credits: 25000,
					intelPromotion: { planLookupKey: 'intel-exclusive-14d', days: 14 },
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

describe('manual invoice and issuer controls', () => {
	it('creates a manual draft with explicit instructions and recipient fields, without sending or settlement', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Create invoice draft' }));
		const dialog = screen.getByRole('dialog', { name: 'Create prepaid invoice draft' });
		fireEvent.change(within(dialog).getByLabelText('Customer email'), { target: { value: 'customer@example.com' } });
		fireEvent.change(within(dialog).getByLabelText(/^Due date/), {
			target: { value: new Date(Date.now() + 86400000).toISOString().slice(0, 16) },
		});
		fireEvent.change(within(dialog).getByLabelText('Collection method'), { target: { value: 'manual' } });
		fireEvent.change(within(dialog).getByLabelText(/^Manual payment instructions/), {
			target: { value: 'Verified bank details supplied by operator' },
		});
		fireEvent.change(within(dialog).getByLabelText('Customer billing address (optional)'), {
			target: { value: 'Customer supplied address' },
		});
		fireEvent.change(within(dialog).getByLabelText('Customer tax ID (optional)'), { target: { value: 'customer-tax-id' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save invoice draft' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith(
				'/invoices',
				expect.objectContaining({
					collectionMethod: 'manual',
					manualPaymentInstructions: 'Verified bank details supplied by operator',
					recipientAddress: 'Customer supplied address',
					recipientTaxId: 'customer-tax-id',
				}),
			),
		);
		expect(billingPost).toHaveBeenCalledTimes(1);
	});
	it('omits stale manual instructions after switching to gateway', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Create invoice draft' }));
		const dialog = screen.getByRole('dialog', { name: 'Create prepaid invoice draft' });
		fireEvent.change(within(dialog).getByLabelText('Customer email'), { target: { value: 'customer@example.com' } });
		fireEvent.change(within(dialog).getByLabelText(/^Due date/), {
			target: { value: new Date(Date.now() + 86400000).toISOString().slice(0, 16) },
		});
		fireEvent.change(within(dialog).getByLabelText('Collection method'), { target: { value: 'manual' } });
		fireEvent.change(within(dialog).getByLabelText(/^Manual payment instructions/), { target: { value: 'stale bank instructions' } });
		fireEvent.change(within(dialog).getByLabelText('Collection method'), { target: { value: 'gateway' } });
		expect(within(dialog).queryByLabelText(/^Manual payment instructions/)).toBeNull();
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save invoice draft' }));
		await waitFor(() => expect(billingPost).toHaveBeenCalledTimes(1));
		expect(vi.mocked(billingPost).mock.calls[0][1]).not.toHaveProperty('manualPaymentInstructions');
	});
	it('records a partial receipt only after explicit evidence confirmation and rejects overpayment', async () => {
		invoice = {
			...fixture,
			collectionMethod: 'manual',
			status: 'claimed',
			workspaceId: 'ws_test',
			providerInvoiceId: 'inv_native',
			manualPaymentInstructions: 'Verified bank instructions',
		};
		detailExtra = { amountPaidMinor: 0, amountRemainingMinor: 33149406, externalPayments: [] };
		mount('/billing/prepaid-invoices/inv-test');
		fireEvent.click(await screen.findByRole('button', { name: 'Record received payment' }));
		const dialog = screen.getByRole('dialog', { name: 'Record received payment' });
		expect(within(dialog).getByRole('button', { name: 'Record this payment' })).toBeDisabled();
		fireEvent.change(within(dialog).getByLabelText('Bank or receipt reference'), { target: { value: 'bank-receipt-unique' } });
		fireEvent.change(within(dialog).getByLabelText('Amount received (NGN)'), { target: { value: '331495.00' } });
		fireEvent.click(within(dialog).getByRole('checkbox'));
		fireEvent.click(within(dialog).getByRole('button', { name: 'Record this payment' }));
		expect(await within(dialog).findByRole('alert')).toHaveTextContent('exceeds');
		expect(billingPost).not.toHaveBeenCalled();
		fireEvent.change(within(dialog).getByLabelText('Amount received (NGN)'), { target: { value: '100000.01' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Record this payment' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith(
				'/invoices/inv-test/record-payment',
				expect.objectContaining({ reference: 'bank-receipt-unique', amountMinor: 10000001, currency: 'NGN', method: 'bank_transfer' }),
			),
		);
		expect(billingPost).toHaveBeenCalledTimes(1);
	});
	it('keeps pending evidence immutable when reconciling the same provider payment', async () => {
		invoice = {
			...fixture,
			collectionMethod: 'manual',
			status: 'payment_pending',
			workspaceId: 'ws_test',
			providerInvoiceId: 'inv_native',
		};
		const receivedAt = new Date(Date.now() - 86400000).toISOString();
		detailExtra = {
			amountPaidMinor: 0,
			amountRemainingMinor: 33149406,
			externalPayments: [
				{
					id: 'ep_1',
					prepaidInvoiceId: invoice.id,
					providerInvoiceId: 'inv_native',
					reference: 'same-receipt',
					amountMinor: 100001,
					currency: 'NGN',
					method: 'cash',
					receivedAt,
					recordedBy: 'admin-test',
					recordedAt: receivedAt,
					providerPaymentId: null,
					confirmedAt: null,
				},
			],
		};
		mount('/billing/prepaid-invoices/inv-test');
		fireEvent.click(await screen.findByRole('button', { name: 'Reconcile pending payment' }));
		const dialog = screen.getByRole('dialog', { name: 'Reconcile received payment' });
		expect(within(dialog).getByLabelText('Bank or receipt reference')).toHaveAttribute('readonly');
		fireEvent.click(within(dialog).getByRole('checkbox'));
		fireEvent.click(within(dialog).getByRole('button', { name: 'Reconcile this payment' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith('/invoices/inv-test/record-payment', {
				reference: 'same-receipt',
				amountMinor: 100001,
				currency: 'NGN',
				method: 'cash',
				receivedAt,
			}),
		);
	});
	it('requires verified account attribution before recording manual payment', async () => {
		invoice = { ...fixture, collectionMethod: 'manual', status: 'issued' };
		mount('/billing/prepaid-invoices/inv-test');
		await screen.findByText(/The recipient must open the invoice link/);
		expect(screen.queryByRole('button', { name: 'Prepare manual invoice' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Record received payment' })).toBeNull();
		expect(billingPost).not.toHaveBeenCalled();
	});
	it('loads empty optional issuer fields and saves only operator supplied profile details', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Plaqad invoice details' }));
		const dialog = screen.getByRole('dialog', { name: 'Plaqad invoice details' });
		const address = await within(dialog).findByLabelText('Issuer address');
		expect(address).toHaveValue('');
		expect(billingPut).not.toHaveBeenCalled();
		fireEvent.change(address, { target: { value: 'Verified Plaqad address' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Save invoice details' }));
		await waitFor(() =>
			expect(billingPut).toHaveBeenCalledWith('/document-profile', {
				displayName: 'Plaqad',
				website: 'https://plaqad.com',
				address: 'Verified Plaqad address',
			}),
		);
		expect(billingPost).not.toHaveBeenCalled();
	});
});

describe('owner consent and manual account claims', () => {
	it('searches all prepaid invoices on the server by an old alias and displays the canonical number', async () => {
		vi.mocked(billingGet).mockImplementation(async (path) => {
			if (path === '/invoices') return { invoices: [] };
			if (path === '/invoices?search=INV-OLD') return { invoices: [{ ...fixture, publicReference: '8K4M2P' }], nextBefore: null };
			return { invoice: { ...fixture, publicReference: '8K4M2P' } };
		});
		mount();
		fireEvent.change(await screen.findByLabelText('Find an invoice'), { target: { value: 'INV-OLD' } });
		fireEvent.click(await screen.findByRole('button', { name: '8K4M2P' }));
		await waitFor(() => expect(billingGet).toHaveBeenCalledWith('/invoices?search=INV-OLD'));
		await waitFor(() => expect(billingGet).toHaveBeenCalledWith('/invoices/inv-test'));
		expect(billingPost).not.toHaveBeenCalled();
	});
	it('loads the next prepaid invoice batch using the server cursor without losing the search', async () => {
		vi.mocked(billingGet).mockImplementation(async (path) => {
			if (path === '/invoices?search=customer')
				return { invoices: [{ ...fixture, publicReference: 'FIRST1' }], nextBefore: '2026-09-01T00:00:00.000Z' };
			if (path.includes('before=')) return { invoices: [{ ...fixture, id: 'older-invoice', publicReference: 'OLDER2' }], nextBefore: null };
			return { invoices: [] };
		});
		mount();
		fireEvent.change(await screen.findByLabelText('Find an invoice'), { target: { value: 'customer' } });
		await screen.findByRole('button', { name: 'FIRST1' });
		fireEvent.click(screen.getByRole('button', { name: 'Load more invoices' }));
		await screen.findByRole('button', { name: 'OLDER2' });
		expect(billingGet).toHaveBeenCalledWith('/invoices?search=customer&before=2026-09-01T00%3A00%3A00.000Z');
		expect(screen.getByRole('button', { name: 'FIRST1' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Load more invoices' })).toBeNull();
	});
	it('does not offer staff checkout preparation for a recurring gateway plan', async () => {
		invoice = { ...fixture, kind: 'plan', credits: null, planLookupKey: 'intel-pulse', collectionMethod: 'gateway', status: 'issued' };
		mount('/billing/prepaid-invoices/inv-test');
		await screen.findByText(/The customer reviews the plan and recurring payment consent/);
		expect(screen.queryByRole('button', { name: 'Prepare Paystack link' })).toBeNull();
		expect(billingPost).not.toHaveBeenCalled();
	});
	it('prepares a claimed manual invoice with the verified workspace and no checkout assumption', async () => {
		invoice = { ...fixture, collectionMethod: 'manual', status: 'claimed', workspaceId: 'ws_claimed' };
		mount('/billing/prepaid-invoices/inv-test');
		fireEvent.click(await screen.findByRole('button', { name: 'Prepare manual invoice' }));
		const dialog = screen.getByRole('dialog', { name: 'Prepare manual invoice' });
		expect(within(dialog).getByLabelText(/^Customer workspace ID/)).toHaveValue('ws_claimed');
		fireEvent.click(within(dialog).getByRole('checkbox'));
		fireEvent.click(within(dialog).getByRole('button', { name: 'Prepare manual invoice' }));
		await waitFor(() => expect(billingPost).toHaveBeenCalledWith('/invoices/inv-test/prepare-payment', { workspaceId: 'ws_claimed' }));
		expect(billingPost).toHaveBeenCalledTimes(1);
	});
});
