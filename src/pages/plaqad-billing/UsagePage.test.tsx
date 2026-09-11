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
}));
vi.mock('@/api/PlaqadBillingApi', () => ({ billingGet: vi.fn() }));
import { billingGet, type UsageResponse } from '@/api/PlaqadBillingApi';
import UsagePage from './UsagePage';
import { usageQuery } from './usage';

const filters = { from: '2026-09-01', to: '2026-09-11', workspaceId: '', userId: '', product: '' };
const activity = {
	creditsDebited: 0,
	creditsRefunded: 25,
	netCredits: -25,
	usageEvents: 5,
	planIncludedOperations: 3,
	planAllowanceOperations: 2,
	planUnits: 7,
	planUsageCreditsEquivalent: 40,
};
const response: UsageResponse = {
	period: { from: '2026-09-01T00:00:00Z', to: '2026-09-12T00:00:00Z' },
	summary: { ...activity, workspaces: 1, users: 0 },
	items: [
		{
			...activity,
			workspaceId: 'ws_a',
			workspaceName: 'Example workspace',
			userId: null,
			userName: null,
			userEmail: null,
			actorType: 'system',
			product: 'intel',
			serviceId: 'svc_intel',
			lastUsedAt: '2026-09-11T12:00:00Z',
		},
	],
	pagination: { limit: 50, offset: 0, total: 75 },
	coverage: {
		costAvailable: false,
		historicalPlanOperationsWithoutActuals: 3,
		message: 'Consumption refunds are included; reservation hold releases are excluded.',
	},
};
function mount() {
	return render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<MemoryRouter>
				<UsagePage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}
beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(billingGet).mockResolvedValue(response);
});
describe('usage period query', () => {
	it('includes the full selected end date through an exclusive next-day boundary', () => {
		const params = new URLSearchParams(usageQuery({ ...filters, from: '2026-09-11', workspaceId: ' ws_a ' }, 50).split('?')[1]);
		expect(params.get('from')).toBe(new Date('2026-09-11T00:00:00').toISOString());
		expect(params.get('to')).toBe(new Date('2026-09-12T00:00:00').toISOString());
		expect(params.get('workspaceId')).toBe('ws_a');
		expect(params.get('offset')).toBe('50');
	});
	it('rejects impossible dates, more than 93 days, oversized filters and invalid pagination', () => {
		for (const next of [
			{ ...filters, from: '2026-02-30' },
			{ ...filters, from: '' },
			{ ...filters, from: '2026-09-12' },
			{ ...filters, from: '2026-01-01', to: '2026-04-04' },
			{ ...filters, userId: 'a'.repeat(161) },
		])
			expect(() => usageQuery(next, 0)).toThrow();
		for (const offset of [-1, 0.5, 100001, NaN]) expect(() => usageQuery(filters, offset)).toThrow();
		expect(() => usageQuery({ ...filters, from: '2026-01-01', to: '2026-04-03' }, 0)).not.toThrow();
	});
});
describe('operator usage view', () => {
	it('preserves negative net refunds and distinguishes plan-funded activity from credit debits', async () => {
		mount();
		expect(await screen.findByText('Background activity')).toBeInTheDocument();
		expect(screen.getAllByText('-25')).toHaveLength(2);
		expect(screen.getByText('Net usage credits')).toBeInTheDocument();
		const panel = screen.getByRole('heading', { name: 'Plan-funded activity' }).closest('section')!;
		expect(within(panel).getByText('Included operations')).toBeInTheDocument();
		expect(within(panel).getByText('Allowance operations')).toBeInTheDocument();
		expect(within(panel).getByText('40')).toBeInTheDocument();
		expect(within(panel).getByText(/were not deducted/)).toBeInTheDocument();
		expect(screen.getByText(/3 older plan operations/)).toBeInTheDocument();
		expect(screen.getByText('3 included · 2 allowance')).toBeInTheDocument();
	});
	it('applies all filters, paginates and resets pagination when filters change', async () => {
		mount();
		await screen.findByText('Background activity');
		fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		await waitFor(() => expect(billingGet).toHaveBeenLastCalledWith(expect.stringContaining('offset=50')));
		fireEvent.change(screen.getByLabelText('From'), { target: { value: filters.from } });
		fireEvent.change(screen.getByLabelText('To'), { target: { value: filters.to } });
		fireEvent.change(screen.getByLabelText('Workspace ID'), { target: { value: ' ws_a ' } });
		fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'usr_example' } });
		fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'intel' } });
		fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
		await waitFor(() =>
			expect(billingGet).toHaveBeenLastCalledWith(
				usageQuery({ ...filters, workspaceId: 'ws_a', userId: 'usr_example', product: 'intel' }, 0),
			),
		);
	});
	it('shows a date-range error without requesting an invalid report', async () => {
		mount();
		await screen.findByText('Background activity');
		const calls = vi.mocked(billingGet).mock.calls.length;
		fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
		fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-04-04' } });
		fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
		expect(screen.getByRole('alert')).toHaveTextContent('up to 93 days');
		expect(billingGet).toHaveBeenCalledTimes(calls);
	});
});
