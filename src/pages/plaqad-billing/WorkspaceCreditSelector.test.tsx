import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('@/api/PlaqadBillingApi', () => ({ billingGet: vi.fn() }));
vi.mock('@/core/auth/PlaqadAuth', () => ({ getPlaqadUser: () => ({ sub: 'admin_example' }) }));
vi.mock('@/components/atoms', () => ({
	Page: () => null,
	Button: ({ children, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
		<button {...props}>{children}</button>
	),
}));
import { billingGet, type CreditWorkspacesResponse } from '@/api/PlaqadBillingApi';
import WorkspaceCreditSelector from './WorkspaceCreditSelector';

const alpha = { id: 'ws_alpha', name: 'Alpha studio', slug: 'alpha-studio', status: 'ACTIVE' };
const beta = { id: '11111111-2222-4333-8444-555555555555', name: 'Beta studio', slug: 'beta-studio', status: 'ACTIVE' };
function mount() {
	const onSelect = vi.fn();
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={client}>
			<WorkspaceCreditSelector selectedId='' onSelect={onSelect} />
		</QueryClientProvider>,
	);
	return onSelect;
}
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(billingGet).mockResolvedValue({ workspaces: [alpha], hasMore: false });
});
describe('workspace credits selector', () => {
	it('loads a bounded first page on focus, shows names and refines server-side', async () => {
		const onSelect = mount();
		expect(billingGet).not.toHaveBeenCalled();
		fireEvent.focus(screen.getByLabelText('Find workspace'));
		await screen.findByText('Alpha studio');
		expect(billingGet).toHaveBeenCalledWith('/workspace-credits/workspaces?search=&limit=20', expect.any(AbortSignal));
		vi.mocked(billingGet).mockResolvedValue({ workspaces: [beta], hasMore: true });
		fireEvent.change(screen.getByLabelText('Find workspace'), { target: { value: ' beta ' } });
		expect(screen.queryByText('Alpha studio')).not.toBeInTheDocument();
		expect(billingGet).toHaveBeenCalledTimes(1);
		fireEvent.click(await screen.findByRole('button', { name: /Beta studio.*View credits/ }));
		expect(billingGet).toHaveBeenLastCalledWith('/workspace-credits/workspaces?search=beta&limit=20', expect.any(AbortSignal));
		expect(onSelect).toHaveBeenCalledWith(beta.id);
		expect(screen.queryByRole('list', { name: 'Matching workspaces' })).not.toBeInTheDocument();
	});
	it('aborts superseded searches and ignores responses arriving out of order', async () => {
		let resolveOld!: (response: CreditWorkspacesResponse) => void;
		let oldSignal: AbortSignal | undefined;
		vi.mocked(billingGet).mockImplementation((path, signal) => {
			if (path.includes('search=alpha')) {
				oldSignal = signal;
				return new Promise((resolve) => {
					resolveOld = resolve;
				});
			}
			return Promise.resolve({ workspaces: [beta], hasMore: false });
		});
		mount();
		fireEvent.change(screen.getByLabelText('Find workspace'), { target: { value: 'alpha' } });
		await waitFor(() => expect(resolveOld).toBeDefined());
		fireEvent.change(screen.getByLabelText('Find workspace'), { target: { value: 'beta' } });
		await screen.findByText('Beta studio');
		expect(oldSignal?.aborted).toBe(true);
		await act(async () => {
			resolveOld({ workspaces: [alpha], hasMore: false });
		});
		expect(screen.queryByText('Alpha studio')).not.toBeInTheDocument();
		expect(screen.getByText('Beta studio')).toBeInTheDocument();
	});
	it('removes results after a denied refresh and offers retry without selecting anything', async () => {
		const onSelect = mount();
		fireEvent.focus(screen.getByLabelText('Find workspace'));
		await screen.findByText('Alpha studio');
		fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
		vi.mocked(billingGet).mockRejectedValue(new Error('Super Admin role required.'));
		fireEvent.focus(screen.getByLabelText('Find workspace'));
		expect(await screen.findByRole('alert')).toHaveTextContent('Super Admin role required.');
		expect(screen.queryByText('Alpha studio')).not.toBeInTheDocument();
		expect(onSelect).not.toHaveBeenCalled();
	});
	it('preserves exact email search in the request but displays only workspace results', async () => {
		vi.mocked(billingGet).mockResolvedValue({ workspaces: [alpha], hasMore: true });
		mount();
		fireEvent.change(screen.getByLabelText('Find workspace'), { target: { value: 'owner@example.test' } });
		await screen.findByText('Alpha studio');
		expect(billingGet).toHaveBeenCalledWith('/workspace-credits/workspaces?search=owner%40example.test&limit=20', expect.any(AbortSignal));
		expect(screen.queryByText('owner@example.test')).not.toBeInTheDocument();
		expect(screen.getByText(/More workspaces match/)).toBeInTheDocument();
	});
});
