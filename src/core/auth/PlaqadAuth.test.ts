import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tokenKey = 'plaqad_flexprice_token';
const expiryKey = 'plaqad_flexprice_token_expires_at';
const returnKey = 'plaqad_flexprice_return_to';
let navigate: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv('VITE_PLAQAD_CLIENT_ID', 'test-client');
	vi.stubEnv('VITE_PLAQAD_AUTH_URL', 'https://account-api.plaqad.com');
	sessionStorage.clear();
	navigate = vi.fn();
	fetcher = vi.fn();
	vi.stubGlobal('fetch', fetcher);
	vi.stubGlobal('crypto', webcrypto);
	vi.stubGlobal('window', {
		location: {
			origin: 'https://bsp.example',
			pathname: '/billing/prepaid-invoices/inv_1',
			search: '?view=detail',
			hash: '#payment',
			assign: navigate,
		},
	});
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});
function session(expiry: string | null = String(Date.now() + 900_000)) {
	sessionStorage.setItem(tokenKey, 'old-token');
	if (expiry !== null) sessionStorage.setItem(expiryKey, expiry);
}
function response() {
	return new Response(JSON.stringify({ token: 'new-token', expiresAt: Math.floor(Date.now() / 1000) + 900 }), { status: 200 });
}

describe('Plaqad session recovery', () => {
	it('uses a valid session without refresh and normalizes refreshed expiry in seconds', async () => {
		const { getPlaqadAccessToken } = await import('./PlaqadAuth');
		session();
		expect(await getPlaqadAccessToken()).toBe('old-token');
		expect(fetcher).not.toHaveBeenCalled();
		session(String(Date.now() + 30_000));
		fetcher.mockResolvedValue(response());
		expect(await getPlaqadAccessToken()).toBe('new-token');
		expect(Number(sessionStorage.getItem(expiryKey))).toBeGreaterThan(Date.now() + 800_000);
	});
	it.each([null, 'NaN', 'Infinity', '0'])('refreshes an invalid stored expiry %s instead of replaying the old token', async (expiry) => {
		session(expiry);
		fetcher.mockResolvedValue(response());
		const { getPlaqadAccessToken } = await import('./PlaqadAuth');
		expect(await getPlaqadAccessToken()).toBe('new-token');
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	it('deduplicates concurrent refresh and includes cookie credentials with a timeout', async () => {
		session(String(Date.now() - 1));
		fetcher.mockResolvedValue(response());
		const { getPlaqadAccessToken } = await import('./PlaqadAuth');
		expect(await Promise.all([getPlaqadAccessToken(), getPlaqadAccessToken()])).toEqual(['new-token', 'new-token']);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'include', signal: expect.any(AbortSignal) });
	});
	it.each(['cookie-blocked', 'network', 'invalid-response'])(
		'reauthorizes once after %s, preserves the detail path and never returns an expired token',
		async (failure) => {
			session(String(Date.now() - 1));
			if (failure === 'network') fetcher.mockRejectedValue(new TypeError('Network unavailable'));
			else
				fetcher.mockResolvedValue(
					failure === 'cookie-blocked'
						? new Response('{}', { status: 401 })
						: new Response(JSON.stringify({ token: 'bad', expiresAt: null })),
				);
			const { getPlaqadAccessToken } = await import('./PlaqadAuth');
			const results = await Promise.allSettled([getPlaqadAccessToken(), getPlaqadAccessToken()]);
			expect(results.every((result) => result.status === 'rejected' && result.reason.name === 'PlaqadReauthenticationError')).toBe(true);
			expect(fetcher).toHaveBeenCalledTimes(1);
			expect(navigate).toHaveBeenCalledTimes(1);
			const target = new URL(navigate.mock.calls[0][0]);
			expect(target.origin).toBe('https://account-api.plaqad.com');
			expect(target.searchParams.get('redirect_uri')).toBe('https://bsp.example/auth/plaqad/callback');
			expect(target.searchParams.get('code_challenge_method')).toBe('S256');
			expect(sessionStorage.getItem(returnKey)).toBe('/billing/prepaid-invoices/inv_1?view=detail#payment');
			expect(sessionStorage.getItem(tokenKey)).toBeNull();
			await expect(getPlaqadAccessToken()).rejects.toMatchObject({ name: 'PlaqadReauthenticationError' });
			expect(navigate).toHaveBeenCalledTimes(1);
		},
	);
	it('does not auto-redirect a browser with no session', async () => {
		const { getPlaqadAccessToken } = await import('./PlaqadAuth');
		expect(await getPlaqadAccessToken()).toBeNull();
		expect(fetcher).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});
	it.each(['//attacker.test', '/\\attacker.test', '/auth', '/auth/plaqad/callback?code=secret', '/billing/../auth'])(
		'rejects unsafe or looping return path %s',
		async (path) => {
			const { safePlaqadReturnTo } = await import('./PlaqadAuth');
			expect(safePlaqadReturnTo(path)).toBe('/');
		},
	);
	it('requires single-use callback state and rejects invalid token responses', async () => {
		const { startPlaqadLogin, completePlaqadLogin } = await import('./PlaqadAuth');
		await startPlaqadLogin('/billing/usage');
		const state = sessionStorage.getItem('plaqad_flexprice_oauth_state')!;
		fetcher.mockResolvedValue(new Response(JSON.stringify({ token: 'bad' })));
		await expect(completePlaqadLogin('code', 'wrong')).rejects.toThrow(/state/);
		expect(fetcher).not.toHaveBeenCalled();
		await expect(completePlaqadLogin('code', state)).rejects.toThrow(/invalid or expired/);
		expect(sessionStorage.getItem(tokenKey)).toBeNull();
		await expect(completePlaqadLogin('code', state)).rejects.toThrow(/state/);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
