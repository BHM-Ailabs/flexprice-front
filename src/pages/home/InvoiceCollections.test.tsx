import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
vi.mock('@/core/routes/Routes', () => ({ RouteNames: { revenue: '/revenue' } }));
vi.mock('@/hooks/useEnvironment', () => ({ useEnvironment: () => ({ activeEnvironment: { id: 'production' } }) }));
vi.mock('@/api/RevenueDashboardApi', () => ({ default: { getRevenueDashboard: vi.fn() } }));
import RevenueDashboardApi from '@/api/RevenueDashboardApi';
import InvoiceCollections from './InvoiceCollections';
const mount = () =>
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<MemoryRouter>
				<InvoiceCollections />
			</MemoryRouter>
		</QueryClientProvider>,
	);
describe('Home invoice collections', () => {
	beforeEach(() => vi.clearAllMocks());
	it('shows the confirmed one-off receipt in its currency using the repaired report', async () => {
		vi.mocked(RevenueDashboardApi.getRevenueDashboard).mockResolvedValue({
			collections: {
				ngn: { total_invoiced: '331494.06', total_paid: '331494.06', total_unpaid: '0', invoice_count: 1 },
				usd: { total_invoiced: '20', total_paid: '5', total_unpaid: '15', invoice_count: 1 },
			},
		} as never);
		mount();
		expect(await screen.findByText(/331,494.06 collected/)).toBeTruthy();
		expect(screen.getByText(/5.00 collected/)).toBeTruthy();
		expect(screen.getByText(/not earned revenue or cash flow by payment date/)).toBeTruthy();
		expect(screen.getByRole('link', { name: 'View revenue and invoices' }).getAttribute('href')).toBe('/revenue');
		const request = vi.mocked(RevenueDashboardApi.getRevenueDashboard).mock.calls[0][0];
		expect(new Date(request.period_end).valueOf()).toBeGreaterThan(new Date(request.period_start).valueOf());
		expect(request.customer_ids).toEqual([]);
	});
	it('does not turn a reporting error into a zero revenue claim', async () => {
		vi.mocked(RevenueDashboardApi.getRevenueDashboard).mockRejectedValue(new Error('offline'));
		mount();
		expect(await screen.findByRole('alert')).toBeTruthy();
		expect(screen.queryByText(/No finalized invoices/)).toBeNull();
	});
});
