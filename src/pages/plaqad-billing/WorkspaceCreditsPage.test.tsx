import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
vi.mock('@/components/atoms', () => ({
	Page: ({ children, heading }: { children: React.ReactNode; heading: string }) => (
		<main>
			<h1>{heading}</h1>
			{children}
		</main>
	),
	Button: ({ children, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
		<button {...props}>{children}</button>
	),
}));
vi.mock('@/api/PlaqadBillingApi', () => ({ billingGet: vi.fn() }));
vi.mock('@/core/auth/PlaqadAuth', () => ({ getPlaqadUser: () => ({ sub: 'admin_example' }) }));
import { billingGet, type WorkspaceCreditsResponse, type WorkspaceCreditEntry } from '@/api/PlaqadBillingApi';
import WorkspaceCreditsPage from './WorkspaceCreditsPage';
import { creditPaymentAmount, customerWorkspaceCreditsHref, workspaceCreditsHref, workspaceCreditsQuery } from './workspaceCredits';
const debit: WorkspaceCreditEntry = {
	id: 'ledger_usage',
	ledgerId: 'ledger_usage',
	ts: '2026-09-11T12:00:00Z',
	type: 'DEBIT',
	amount: -650,
	effect: 'usage_debit',
	application: 'intel',
	serviceId: 'service_intel',
	serviceName: 'Plaqad Intel',
	actor: { type: 'user', id: 'user_example' },
	bucket: 'purchased',
	reasonCode: 'CATALOG_BATCH',
	callId: 'call_example',
	reservationId: null,
	catalogVersion: 4,
	plan: null,
	rateEvidence: {
		status: 'catalog_snapshot',
		message: 'Frozen catalog version 4 used when this event settled.',
		events: [
			{
				eventId: 'event_example',
				sku: 'intel.report',
				units: 1,
				credits: 650,
				catalogVersion: 4,
				displayName: 'Intelligence report',
				unit: 'report',
				unitScale: 1,
				creditPrice: 650,
				pricingMode: 'markup',
				markupBps: 3000,
				usdCostMicro: 5000000,
			},
		],
		payment: null,
		truncated: false,
	},
	mirror: { pending: 0, sending: 0, sent: 1, dead: 0 },
};
const plan: WorkspaceCreditEntry = {
	...debit,
	id: 'funding_plan',
	ledgerId: null,
	type: 'PLAN_USAGE',
	amount: 0,
	effect: 'plan_usage',
	plan: {
		source: 'plan_allowance',
		planLookupKey: 'intel-exclusive',
		operation: 'intel.report',
		actualCreditsEquivalent: 650,
		actualPlanUnits: 1,
	},
	rateEvidence: {
		status: 'not_applicable',
		message: 'Covered by a plan allowance; no credit debit.',
		events: [],
		payment: null,
		truncated: false,
	},
	mirror: null,
};
const response: WorkspaceCreditsResponse = {
	asOf: '2026-09-11T12:01:00Z',
	source: 'plaqad_auth',
	workspace: { id: 'ws_a', name: 'Example workspace', slug: 'example-workspace', status: 'ACTIVE' },
	customer: { id: 'cust_a', externalId: 'ws_a' },
	balance: { availableCredits: 23900, heldCredits: 100, totalCredits: 24000, lockedReason: null, updatedAt: '2026-09-11T12:00:00Z' },
	totals: {
		awardedCredits: 25000,
		purchasedCredits: 25000,
		openingCredits: 0,
		usedCredits: 1200,
		refundedCredits: 200,
		expiredCredits: 0,
		adjustmentNet: 0,
		ledgerBalance: 23900,
		reconciliationDelta: 0,
	},
	planUsage: {
		includedOperations: 2,
		allowanceOperations: 1,
		actualCreditsEquivalent: 650,
		actualPlanUnits: 1,
		operationsWithoutActuals: 1,
	},
	items: [debit, plan],
	pagination: { limit: 50, nextBefore: 'opaque+/=cursor', hasMore: true },
	coverage: { message: 'Lifetime totals exclude reservation releases from consumption refunds.' },
};
function mount(path = '/billing/workspace-credits?workspaceId=ws_a&customerId=cust_a') {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={client}>
			<MemoryRouter initialEntries={[path]}>
				<WorkspaceCreditsPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}
beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(billingGet).mockResolvedValue(structuredClone(response));
});
describe('workspace credits read model', () => {
	it('shows balances and frozen applied rates while keeping plan usage at zero debit', async () => {
		mount();
		await screen.findByText('Example workspace');
		expect(screen.getByText('23,900', { selector: 'p' })).toBeInTheDocument();
		expect(screen.getByText('Held for pending work')).toBeInTheDocument();
		expect(screen.getByText(/Available credits already exclude pending holds/)).toBeInTheDocument();
		expect(screen.getByText(/Recorded rate: 650 credits per 1 report/)).toBeInTheDocument();
		expect(screen.getByText(/30% cost markup/)).toBeInTheDocument();
		expect(screen.getByText(/not measured provider spend/)).toBeInTheDocument();
		const row = screen.getByText('Plan activity').closest('tr')!;
		expect(within(row).getByText('0')).toBeInTheDocument();
		expect(within(row).queryByText('-650')).not.toBeInTheDocument();
		expect(billingGet).toHaveBeenCalledWith(workspaceCreditsQuery('ws_a', 'cust_a'), expect.any(AbortSignal));
		expect(billingGet).toHaveBeenCalledTimes(1);
	});
	it('does not request all workspaces or accept an invalid workspace id', async () => {
		mount('/billing/workspace-credits');
		expect(billingGet).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('Open by workspace ID'));
		fireEvent.change(screen.getByLabelText('Workspace ID'), { target: { value: 'another-customer' } });
		fireEvent.click(screen.getByRole('button', { name: 'View credits' }));
		expect(screen.getByRole('alert')).toHaveTextContent('valid Plaqad workspace');
		expect(billingGet).not.toHaveBeenCalled();
	});
	it('rejects mismatched native customer attribution before showing balances', async () => {
		vi.mocked(billingGet).mockResolvedValue({ ...response, customer: { id: 'cust_other', externalId: 'ws_a' } });
		mount();
		expect(await screen.findByRole('alert')).toHaveTextContent('mapping could not be verified');
		expect(screen.queryByText('Available credits')).not.toBeInTheDocument();
		expect(screen.queryByText('Intelligence report')).not.toBeInTheDocument();
	});
	it('passes opaque cursors untouched and resets pagination for a different workspace', async () => {
		mount();
		await screen.findByText('Example workspace');
		fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await waitFor(() =>
			expect(billingGet).toHaveBeenLastCalledWith(workspaceCreditsQuery('ws_a', 'cust_a', 'opaque+/=cursor'), expect.any(AbortSignal)),
		);
		vi.mocked(billingGet).mockResolvedValue({
			...response,
			workspace: { ...response.workspace, id: 'ws_b', name: 'Second workspace' },
			customer: null,
		});
		fireEvent.click(screen.getByText('Open by workspace ID'));
		fireEvent.change(screen.getByLabelText('Workspace ID'), { target: { value: ' ws_b ' } });
		fireEvent.click(screen.getByRole('button', { name: 'View credits' }));
		await screen.findByText('Second workspace');
		expect(billingGet).toHaveBeenLastCalledWith(workspaceCreditsQuery('ws_b'), expect.any(AbortSignal));
		expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
	});
	it('hides earlier workspace data while the replacement workspace is pending', async () => {
		mount();
		await screen.findByText('Example workspace');
		vi.mocked(billingGet).mockImplementation(() => new Promise(() => {}));
		fireEvent.click(screen.getByText('Open by workspace ID'));
		fireEvent.change(screen.getByLabelText('Workspace ID'), { target: { value: 'ws_b' } });
		fireEvent.click(screen.getByRole('button', { name: 'View credits' }));
		await screen.findByText('Loading workspace credits…');
		expect(screen.queryByText('Example workspace')).not.toBeInTheDocument();
		expect(screen.queryByText('Available credits')).not.toBeInTheDocument();
	});
	it('keeps the customer check for the same selection and clears it for another workspace', async () => {
		vi.mocked(billingGet).mockImplementation(async (path) =>
			path.startsWith('/workspace-credits/workspaces?')
				? {
						workspaces: [response.workspace, { ...response.workspace, id: 'ws_b', name: 'Second workspace' }],
						hasMore: false,
					}
				: path.includes('workspaceId=ws_b')
					? { ...response, workspace: { ...response.workspace, id: 'ws_b', name: 'Second workspace' }, customer: null }
					: structuredClone(response),
		);
		mount();
		await screen.findByText('Example workspace');
		fireEvent.focus(screen.getByLabelText('Find workspace'));
		fireEvent.click(await screen.findByRole('button', { name: /Example workspace.*Selected/ }));
		expect(screen.getByRole('link', { name: 'this customer’s' })).toBeInTheDocument();
		fireEvent.focus(screen.getByLabelText('Find workspace'));
		fireEvent.click(await screen.findByRole('button', { name: /Second workspace.*View credits/ }));
		await screen.findByText('Second workspace');
		expect(screen.queryByRole('link', { name: 'this customer’s' })).not.toBeInTheDocument();
		expect(billingGet).toHaveBeenLastCalledWith(workspaceCreditsQuery('ws_b'), expect.any(AbortSignal));
	});
	it('opens a legacy UUID customer link with the exact workspace and customer attribution', async () => {
		const workspaceId = '11111111-2222-4333-8444-555555555555';
		vi.mocked(billingGet).mockResolvedValue({
			...response,
			workspace: { ...response.workspace, id: workspaceId },
			customer: { id: 'cust_a', externalId: workspaceId },
		});
		mount(customerWorkspaceCreditsHref(workspaceId, 'cust_a')!);
		await screen.findByText('Example workspace');
		expect(billingGet).toHaveBeenCalledWith(workspaceCreditsQuery(workspaceId, 'cust_a'), expect.any(AbortSignal));
		expect(screen.getByRole('link', { name: 'this customer’s' })).toBeInTheDocument();
	});
	it('removes cached financial results when refresh denies the admin session', async () => {
		mount();
		await screen.findByText('Example workspace');
		vi.mocked(billingGet).mockRejectedValue(Object.assign(new Error('Super Admin role required.'), { status: 403 }));
		fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Super Admin role required');
		expect(screen.queryByText('Example workspace')).not.toBeInTheDocument();
		expect(screen.queryByText('Intelligence report')).not.toBeInTheDocument();
	});
	it('preserves historical unknown rates and negative adjustments without inventing cost', async () => {
		vi.mocked(billingGet).mockResolvedValue({
			...response,
			items: [
				{
					...debit,
					effect: 'adjustment',
					amount: -50,
					rateEvidence: { ...debit.rateEvidence, status: 'unavailable', events: [], message: 'No historical catalog rate was recorded.' },
				},
			],
		});
		mount();
		await screen.findByText('Example workspace');
		expect(screen.getByText('-50')).toBeInTheDocument();
		expect(screen.getByText('No historical catalog rate was recorded.')).toBeInTheDocument();
		expect(screen.queryByText(/Recorded rate:/)).not.toBeInTheDocument();
	});
	it('does not turn missing historical event units into zero', async () => {
		vi.mocked(billingGet).mockResolvedValue({
			...response,
			items: [
				{
					...debit,
					rateEvidence: {
						...debit.rateEvidence,
						status: 'reported_credits',
						events: [
							{
								...debit.rateEvidence.events[0],
								sku: null,
								units: null,
								creditPrice: null,
								unitScale: null,
								usdCostMicro: null,
								markupBps: null,
								pricingMode: null,
							},
						],
						message: 'Unit-rate inputs were not retained.',
					},
				},
			],
		});
		mount();
		await screen.findByText('Example workspace');
		expect(screen.getByText(/Units not retained/)).toBeInTheDocument();
		expect(screen.queryByText(/0 units/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Recorded rate:/)).not.toBeInTheDocument();
	});
	it('shows the original payment amount and labels the stored FX rate per USD', async () => {
		vi.mocked(billingGet).mockResolvedValue({
			...response,
			items: [
				{
					...debit,
					type: 'ISSUANCE',
					effect: 'award',
					amount: 25000,
					rateEvidence: {
						status: 'payment_snapshot',
						message: 'Original settled payment and quote-time FX.',
						events: [],
						truncated: false,
						payment: {
							id: 'payment_example',
							reference: 'invoice_example',
							publicReference: '100001',
							amountMinor: 33149406,
							currency: 'NGN',
							creditsAwarded: 25000,
							fxRateMicro: 1325976230,
							fxSpreadBps: 100,
							fxSource: 'quote_snapshot',
							fxAt: '2026-09-11T11:00:00Z',
						},
					},
				},
			],
		});
		mount();
		await screen.findByText('Example workspace');
		expect(screen.getByText(/331,494.06 paid/)).toBeInTheDocument();
		expect(screen.getByText(/NGN 1,325.97623 per USD/)).toBeInTheDocument();
		expect(screen.getByText(/1% spread/)).toBeInTheDocument();
		expect(screen.getByText(/Invoice 100001 · 25,000 credits awarded/)).toBeInTheDocument();
	});
});
describe('workspace credit links and amounts', () => {
	it('preserves both customer and workspace identity in the link without trusting them as authorization', () => {
		const url = new URL(workspaceCreditsHref('ws_a', 'cust_a'), 'https://billing.example');
		expect(url.searchParams.get('workspaceId')).toBe('ws_a');
		expect(url.searchParams.get('customerId')).toBe('cust_a');
		expect(() => workspaceCreditsQuery('ws_a', 'cust/a')).toThrow();
		expect(customerWorkspaceCreditsHref('not-a-workspace', 'cust_a')).toBeNull();
		expect(customerWorkspaceCreditsHref(undefined, 'cust_a')).toBeNull();
	});
	it('renders paid minor-unit amounts using currency precision', () => {
		expect(creditPaymentAmount(33149406, 'NGN')).toContain('331,494.06');
		expect(creditPaymentAmount(1000, 'JPY')).toContain('1,000');
	});
});
