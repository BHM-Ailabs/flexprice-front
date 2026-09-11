import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/core/auth/PlaqadAuth', () => ({ PLAQAD_AUTH_ENABLED: true, getPlaqadAccessToken: vi.fn(), reauthenticatePlaqad: vi.fn() }));
import { getPlaqadAccessToken, reauthenticatePlaqad } from '@/core/auth/PlaqadAuth';
import { billingGet, billingPost } from './PlaqadBillingApi';

describe('Plaqad billing transport', () => {
	beforeEach(() => {
		vi.mocked(getPlaqadAccessToken).mockResolvedValue('test-human-session');
	});
	afterEach(() => vi.unstubAllGlobals());
	it('uses the current human session without BSP environment or machine credential headers', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ versions: [] }), { status: 200 }));
		vi.stubGlobal('fetch', fetcher);
		await billingGet('/catalog/versions');
		const [url, options] = fetcher.mock.calls[0];
		expect(url).toMatch(/\/api\/v1\/admin\/billing\/catalog\/versions$/);
		expect(options.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer test-human-session' });
		expect(options.headers['X-Environment-ID']).toBeUndefined();
	});
	it('does not make requests when the human session is missing', async () => {
		vi.mocked(getPlaqadAccessToken).mockResolvedValue(null);
		const fetcher = vi.fn();
		vi.stubGlobal('fetch', fetcher);
		await expect(billingPost('/catalog/versions', {})).rejects.toThrow(/expired/);
		expect(fetcher).not.toHaveBeenCalled();
	});
	it('reauthorizes a rejected session without replaying an invoice write', async () => {
		vi.mocked(reauthenticatePlaqad).mockRejectedValue(new Error('Reauthorizing'));
		const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
		vi.stubGlobal('fetch', fetcher);
		await expect(billingPost('/invoices', { credits: 500 })).rejects.toThrow('Reauthorizing');
		expect(reauthenticatePlaqad).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it('preserves server authorization errors without automatic retries', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'MFA required' }), { status: 403 }));
		vi.stubGlobal('fetch', fetcher);
		await expect(billingPost('/catalog/versions/6/activate', { reason: 'Reviewed' })).rejects.toMatchObject({
			message: 'MFA required',
			status: 403,
		});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it('propagates a canceled workspace read without replaying it', async () => {
		const controller = new AbortController();
		const fetcher = vi.fn().mockImplementation(
			(_url, options) =>
				new Promise((_resolve, reject) => {
					options.signal.addEventListener('abort', () => reject(options.signal.reason));
				}),
		);
		vi.stubGlobal('fetch', fetcher);
		const result = billingGet('/workspace-credits?workspaceId=ws_example', controller.signal);
		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
		controller.abort();
		await expect(result).rejects.toMatchObject({ name: 'AbortError' });
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
