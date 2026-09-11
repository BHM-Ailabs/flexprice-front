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
	Dialog: ({ children, isOpen, title }: { children: React.ReactNode; isOpen: boolean; title: string }) =>
		isOpen ? (
			<div role='dialog' aria-label={title}>
				{children}
			</div>
		) : null,
}));
vi.mock('@/api/PlaqadBillingApi', () => ({ billingGet: vi.fn(), billingPost: vi.fn() }));
import { billingGet, billingPost, type CatalogDetail, type CatalogItem } from '@/api/PlaqadBillingApi';
import MarkupPage from './MarkupPage';

const item: CatalogItem = {
	sku: 'shared.call',
	product: 'shared',
	displayName: 'Model call',
	unit: 'call',
	unitScale: 1,
	usdCostMicro: 5000000,
	creditPrice: 700,
	pricingMode: 'fixed',
	pricingClass: 'llm',
	markupBps: null,
	active: true,
};
let detail: CatalogDetail;
function mount() {
	return render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
			<MemoryRouter>
				<MarkupPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}
beforeEach(() => {
	vi.clearAllMocks();
	detail = {
		version: 4,
		status: 'active',
		effectiveAt: '2026-09-01T00:00:00Z',
		approvedAt: '2026-09-01T00:00:00Z',
		notes: null,
		pricingPolicy: null,
		items: [item, { ...item, sku: 'zero.cost', displayName: 'Zero-cost operation', usdCostMicro: 0, creditPrice: 10 }],
	};
	vi.mocked(billingGet).mockImplementation(async (path) => (path === '/catalog/versions' ? { versions: [detail] } : detail));
	vi.mocked(billingPost).mockImplementation(async (_path, body) => ({
		...detail,
		...(body as object),
		version: 5,
		status: 'draft',
		approvedAt: null,
	}));
});
describe('usage markup operator review', () => {
	it('preserves the fixed catalogue by default and previews $5 at 30% as exactly 650 credits', async () => {
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Create a pricing draft' }));
		fireEvent.change(screen.getByLabelText(/^Global markup/), { target: { value: '30' } });
		expect(screen.getByText('650')).toBeInTheDocument();
		expect(screen.getByText('US$6.50 in credit value')).toBeInTheDocument();
		expect(billingPost).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith(
				'/catalog/versions',
				expect.objectContaining({ items: [item, expect.objectContaining({ sku: 'zero.cost', creditPrice: 10, pricingMode: 'fixed' })] }),
			),
		);
		expect(billingPost).toHaveBeenCalledTimes(1);
	});
	it('applies uniform markup only when selected and preserves zero-cost fixed prices', async () => {
		detail.pricingPolicy = {
			basis: 'cost_markup',
			defaultMarkupBps: 5000,
			classOverrides: { llm: 10000 },
			skuOverrides: { 'shared.call': 20000 },
		};
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Create a pricing draft' }));
		fireEvent.change(screen.getByLabelText(/^Global markup/), { target: { value: '30' } });
		fireEvent.click(screen.getByRole('checkbox'));
		const row = screen.getByText('Model call').closest('tr')!;
		expect(within(row).getByText('650')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith(
				'/catalog/versions',
				expect.objectContaining({
					pricingPolicy: { basis: 'cost_markup', defaultMarkupBps: 3000, classOverrides: {}, skuOverrides: {} },
					items: [
						expect.objectContaining({ sku: 'shared.call', pricingMode: 'markup', creditPrice: 650, markupBps: 3000 }),
						expect.objectContaining({ sku: 'zero.cost', pricingMode: 'fixed', creditPrice: 10 }),
					],
				}),
			),
		);
	});
	it('retains class and individual overrides while rejecting an invalid draft', async () => {
		detail.items[0] = { ...item, pricingMode: 'markup', markupBps: 3000, creditPrice: 650 };
		detail.pricingPolicy = {
			basis: 'cost_markup',
			defaultMarkupBps: 5000,
			classOverrides: { llm: 3000 },
			skuOverrides: { 'shared.call': 10000 },
		};
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Create a pricing draft' }));
		fireEvent.change(screen.getByLabelText(/^Global markup/), { target: { value: '10' } });
		expect(screen.getByText('550')).toBeInTheDocument();
		expect(within(screen.getByText('Model call').closest('tr')!).getByText('1,000')).toBeInTheDocument();
		fireEvent.change(screen.getByLabelText(/^Global markup/), { target: { value: '1001' } });
		expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
		expect(screen.getByRole('alert')).toHaveTextContent('1000%');
		expect(billingPost).not.toHaveBeenCalled();
	});
	it('requires an explicit reason before activating a saved draft', async () => {
		detail.status = 'draft';
		detail.approvedAt = null;
		mount();
		fireEvent.click(await screen.findByRole('button', { name: 'Review activation' }));
		const dialog = screen.getByRole('dialog');
		expect(within(dialog).getByRole('button', { name: 'Activate version 4' })).toBeDisabled();
		fireEvent.change(within(dialog).getByLabelText('Reason for this pricing change'), { target: { value: 'Approved cost markup review' } });
		fireEvent.click(within(dialog).getByRole('button', { name: 'Activate version 4' }));
		await waitFor(() =>
			expect(billingPost).toHaveBeenCalledWith('/catalog/versions/4/activate', { reason: 'Approved cost markup review' }),
		);
	});
});
