import { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/core/auth/AuthService', () => ({ default: { getAcessToken: vi.fn() } }));
vi.mock('@/api/UserApi', () => ({ UserApi: { me: vi.fn() } }));
import AuthService from '@/core/auth/AuthService';
import { UserApi } from '@/api/UserApi';
import { PlaqadReauthenticationError } from '@/core/auth/PlaqadAuth';
import useUser from './useUser';

function wrapper({ children }: PropsWithChildren) {
	return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}
beforeEach(() => vi.clearAllMocks());
describe('user session query', () => {
	it('waits for a token before requesting the native user and never sends an anonymous request', async () => {
		vi.mocked(AuthService.getAcessToken).mockResolvedValue(null);
		const { result } = renderHook(() => useUser(), { wrapper });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.user).toBeUndefined();
		expect(AuthService.getAcessToken).toHaveBeenCalledTimes(1);
		expect(UserApi.me).not.toHaveBeenCalled();
	});
	it('does not retry or create an unhandled promise when reauthorization starts', async () => {
		vi.mocked(AuthService.getAcessToken).mockRejectedValue(new PlaqadReauthenticationError());
		const { result } = renderHook(() => useUser(), { wrapper });
		await waitFor(() => expect(result.current.error).toBeInstanceOf(PlaqadReauthenticationError));
		expect(AuthService.getAcessToken).toHaveBeenCalledTimes(1);
		expect(UserApi.me).not.toHaveBeenCalled();
	});
});
