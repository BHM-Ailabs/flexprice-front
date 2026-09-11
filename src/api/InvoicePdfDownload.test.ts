import { Blob as NodeBlob } from 'node:buffer';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ token: vi.fn(), logout: vi.fn(), reauthenticate: vi.fn(), environment: vi.fn() }));
vi.mock('@/core/auth/AuthService', () => ({ default: { getAcessToken: auth.token, logout: auth.logout } }));
vi.mock('@/api/EnvironmentApi', () => ({ default: { getActiveEnvironmentId: auth.environment } }));
vi.mock('@/core/auth/PlaqadAuth', () => ({ PLAQAD_AUTH_ENABLED: true, reauthenticatePlaqad: auth.reauthenticate }));

import axiosClient, { clearRuntimeCredentials, setRuntimeCredentials } from '@/core/axios/config';
import InvoiceApi from './InvoiceApi';
import CustomerPortalApi from './CustomerPortalApi';

const originalAdapter = axiosClient.defaults.adapter;
const originalUrl = URL;
let requests: InternalAxiosRequestConfig[];
let clicks: { href: string; filename: string }[];
let createUrl: ReturnType<typeof vi.fn>;
let revokeUrl: ReturnType<typeof vi.fn>;
let responseBlob: Blob;

beforeEach(() => {
	vi.useFakeTimers();
	vi.clearAllMocks();
	clearRuntimeCredentials();
	vi.stubGlobal('Blob', NodeBlob);
	responseBlob = new Blob(['%PDF-1.7\nexact invoice bytes\n%%EOF'], { type: 'application/pdf' });
	requests = [];
	clicks = [];
	createUrl = vi.fn(() => 'blob:invoice-download');
	revokeUrl = vi.fn();
	vi.stubGlobal(
		'URL',
		class extends originalUrl {
			static createObjectURL = createUrl;
			static revokeObjectURL = revokeUrl;
		},
	);
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
		clicks.push({ href: this.href, filename: this.download });
	});
	vi.spyOn(window, 'open').mockImplementation(() => null);
	auth.token.mockResolvedValue('dashboard-token');
	auth.environment.mockReturnValue('env_production');
	axiosClient.defaults.adapter = (async (config) => {
		requests.push(config);
		return { config, data: responseBlob, status: 200, statusText: 'OK', headers: { 'content-type': responseBlob.type } };
	}) satisfies AxiosAdapter;
});

afterEach(() => {
	vi.runOnlyPendingTimers();
	vi.useRealTimers();
	clearRuntimeCredentials();
	axiosClient.defaults.adapter = originalAdapter;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function rejectResponse(status: number, message: string) {
	axiosClient.defaults.adapter = (async (config) => {
		requests.push(config);
		throw new AxiosError(message, 'ERR_BAD_RESPONSE', config, undefined, {
			config,
			status,
			statusText: 'Error',
			headers: {},
			data: new Blob([JSON.stringify({ message })], { type: 'application/json' }),
		});
	}) satisfies AxiosAdapter;
}

describe('authenticated invoice PDF downloads', () => {
	it('downloads dashboard bytes through JWT/environment interceptors without a presigned URL', async () => {
		await InvoiceApi.downloadInvoicePdf('inv_exact');
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({ url: '/invoices/inv_exact/pdf', method: 'get', responseType: 'blob' });
		expect(requests[0].headers.get('Authorization')).toBe('Bearer dashboard-token');
		expect(requests[0].headers.get('X-Environment-ID')).toBe('env_production');
		expect(requests[0].headers.get('Accept')).toBe('application/pdf');
		expect(createUrl).toHaveBeenCalledWith(responseBlob);
		expect(await (createUrl.mock.calls[0][0] as Blob).text()).toBe('%PDF-1.7\nexact invoice bytes\n%%EOF');
		expect(clicks).toEqual([{ href: 'blob:invoice-download', filename: 'invoice-inv_exact.pdf' }]);
		expect(window.open).not.toHaveBeenCalled();
		expect(document.querySelector('a[download]')).toBeNull();
		expect(revokeUrl).not.toHaveBeenCalled();
		vi.advanceTimersByTime(60_000);
		expect(revokeUrl).toHaveBeenCalledWith('blob:invoice-download');
	});

	it('encodes invoice paths and sanitizes a display invoice number only for the filename', async () => {
		await InvoiceApi.getInvoicePdf('inv/a?other', 'INV/2026:001');
		expect(requests[0].url).toBe('/invoices/inv%2Fa%3Fother/pdf');
		expect(clicks[0].filename).toBe('invoice-INV_2026_001.pdf');
	});

	it('uses the portal-only content route and session token without dashboard credentials', async () => {
		setRuntimeCredentials({ sessionToken: 'scoped-customer-token' });
		await CustomerPortalApi.downloadInvoicePdf('inv_customer');
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({ url: '/customer/portal/invoices/inv_customer/pdf/content', responseType: 'blob' });
		expect(requests[0].headers.get('X-Session-Token')).toBe('scoped-customer-token');
		expect(requests[0].headers.get('Authorization')).toBeUndefined();
		expect(requests[0].headers.get('X-Environment-ID')).toBeUndefined();
		expect(auth.token).not.toHaveBeenCalled();
		expect(auth.environment).not.toHaveBeenCalled();
		expect(createUrl).toHaveBeenCalledWith(responseBlob);
	});

	it('retains dashboard reauthentication on 401 without automatically replaying the request', async () => {
		rejectResponse(401, 'Session expired');
		const redirect = new Error('Refreshing your Plaqad sign-in…');
		auth.reauthenticate.mockRejectedValue(redirect);
		await expect(InvoiceApi.downloadInvoicePdf('inv_exact')).rejects.toBe(redirect);
		expect(auth.reauthenticate).toHaveBeenCalledOnce();
		expect(requests).toHaveLength(1);
		expect(createUrl).not.toHaveBeenCalled();
	});

	it('reports portal ownership denial without retrying a private invoice endpoint or saving the error blob', async () => {
		setRuntimeCredentials({ sessionToken: 'scoped-customer-token' });
		rejectResponse(403, 'Invoice does not belong to this customer');
		await expect(CustomerPortalApi.downloadInvoicePdf('inv_other')).rejects.toThrow('Invoice does not belong to this customer');
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe('/customer/portal/invoices/inv_other/pdf/content');
		expect(auth.reauthenticate).not.toHaveBeenCalled();
		expect(createUrl).not.toHaveBeenCalled();
	});

	it.each(['application/json', 'text/html', ''])('rejects successful responses with non-PDF content type %s', async (type) => {
		responseBlob = new Blob(['not an invoice'], { type });
		await expect(InvoiceApi.downloadInvoicePdf('inv_exact')).rejects.toThrow('did not return an invoice PDF');
		expect(createUrl).not.toHaveBeenCalled();
	});

	it('rejects empty PDFs and cleans up if the browser cannot initiate the download', async () => {
		responseBlob = new Blob([], { type: 'application/pdf' });
		await expect(InvoiceApi.downloadInvoicePdf('inv_exact')).rejects.toThrow('did not return an invoice PDF');
		responseBlob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
		vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
			throw new Error('Download blocked');
		});
		await expect(InvoiceApi.downloadInvoicePdf('inv_exact')).rejects.toThrow('Download blocked');
		expect(document.querySelector('a[download]')).toBeNull();
		vi.advanceTimersByTime(60_000);
		expect(revokeUrl).toHaveBeenCalledOnce();
	});
});
