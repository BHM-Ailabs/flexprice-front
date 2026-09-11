import { getPlaqadAccessToken, PLAQAD_AUTH_ENABLED, reauthenticatePlaqad } from '@/core/auth/PlaqadAuth';

const AUTH_URL = (import.meta.env.VITE_PLAQAD_AUTH_URL || 'https://account-api.plaqad.com').replace(/\/$/, '');
const BILLING = '/api/v1/admin/billing';

export class PlaqadBillingError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
	if (!PLAQAD_AUTH_ENABLED) throw new PlaqadBillingError('Sign in through Plaqad Account to manage suite billing.', 401);
	const token = await getPlaqadAccessToken();
	if (!token) throw new PlaqadBillingError('Your Plaqad session has expired. Sign in again to continue.', 401);
	const response = await fetch(`${AUTH_URL}${BILLING}${path}`, {
		...init,
		headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
		signal: AbortSignal.timeout(30_000),
	});
	if (response.status === 401) await reauthenticatePlaqad();
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new PlaqadBillingError(body?.message || `Unable to complete this request (${response.status}).`, response.status);
	}
	return response;
}

export async function billingGet<T>(path: string): Promise<T> {
	return (await request(path)).json();
}
export async function billingPost<T>(path: string, body: unknown): Promise<T> {
	return (await request(path, { method: 'POST', body: JSON.stringify(body) })).json();
}
export async function downloadInvoice(id: string): Promise<void> {
	const response = await request(`/invoices/${encodeURIComponent(id)}/pdf`);
	const url = URL.createObjectURL(await response.blob());
	const link = document.createElement('a');
	link.href = url;
	link.download = `Plaqad-invoice-${id}.pdf`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface MarkupPolicy {
	basis: 'cost_markup';
	defaultMarkupBps: number;
	classOverrides: Record<string, number>;
	skuOverrides: Record<string, number>;
}
export interface CatalogItem {
	sku: string;
	product: string;
	displayName: string;
	unit: string;
	unitScale: number;
	usdCostMicro: number;
	creditPrice: number;
	pricingMode: 'fixed' | 'markup';
	pricingClass: string;
	markupBps: number | null;
	active: boolean;
}
export interface CatalogVersion {
	version: number;
	status: 'draft' | 'active' | 'retired';
	effectiveAt: string;
	approvedAt: string | null;
	notes: string | null;
}
export interface CatalogDetail extends CatalogVersion {
	pricingPolicy: MarkupPolicy | null;
	items: CatalogItem[];
}

export interface UsageSummary {
	creditsDebited: number;
	creditsRefunded: number;
	netCredits: number;
	usageEvents: number;
	planIncludedOperations: number;
	planAllowanceOperations: number;
	planUsageCreditsEquivalent: number;
	planUnits: number;
	workspaces: number;
	users: number;
}
export interface UsageRow {
	workspaceId: string | null;
	workspaceName: string | null;
	userId: string | null;
	userName: string | null;
	userEmail: string | null;
	actorType: 'user' | 'system' | 'unattributed';
	product: string;
	serviceId: string | null;
	creditsDebited: number;
	creditsRefunded: number;
	netCredits: number;
	usageEvents: number;
	planIncludedOperations: number;
	planAllowanceOperations: number;
	planUsageCreditsEquivalent: number;
	planUnits: number;
	lastUsedAt: string | null;
}
export interface UsageResponse {
	period: { from: string; to: string };
	summary: UsageSummary;
	items: UsageRow[];
	pagination: { limit: number; offset: number; total: number };
	coverage: { message: string; costAvailable: boolean; historicalPlanOperationsWithoutActuals: number };
}

export interface PrepaidInvoice {
	id: string;
	invoiceNumber: string;
	recipientEmail: string;
	recipientName: string | null;
	kind: 'credits' | 'plan';
	credits: number | null;
	planLookupKey: string | null;
	planName: string | null;
	amountMinor: number;
	currency: string;
	note: string | null;
	intelPromotion: { planLookupKey: string; days: 14 } | null;
	status: 'draft' | 'issued' | 'claimed' | 'payment_pending' | 'paid' | 'fulfilled' | 'revoked';
	dueAt: string;
	createdAt: string;
	issuedAt: string | null;
	paidAt: string | null;
	fulfilledAt: string | null;
	workspaceId: string | null;
	expired: boolean;
	checkoutState: 'idle' | 'creating' | 'ready';
	providerInvoiceId?: string | null;
	checkoutUrl?: string | null;
}
export interface PrepaidInvoiceDetail {
	invoice: PrepaidInvoice;
	claimUrl?: string;
	checkoutUrl?: string | null;
}
export interface InvoiceCreate {
	idempotencyKey: string;
	recipientEmail: string;
	recipientName?: string;
	kind: 'credits' | 'plan';
	credits?: number;
	amountMinor?: number;
	currency: string;
	dueAt: string;
	planLookupKey?: string;
	note?: string;
	intelPromotion?: { planLookupKey: string; days: 14 };
}

export interface PublicPlan {
	lookupKey: string;
	name: string;
	ctaAction: 'subscribe' | 'sales' | 'custom';
	availableCurrencies: string[];
}
export async function invoicePlans(): Promise<PublicPlan[]> {
	const response = await fetch(`${AUTH_URL}/api/v1/billing/public-plans`, { signal: AbortSignal.timeout(30000) });
	if (!response.ok) throw new Error('Unable to load available plans. Try again.');
	const result = (await response.json()) as { available: boolean; plans: PublicPlan[] };
	if (!result.available) throw new Error('Plans are temporarily unavailable. Try again.');
	return result.plans.filter((plan) => plan.ctaAction === 'subscribe' && plan.lookupKey !== 'plaqad-suite-payg');
}
