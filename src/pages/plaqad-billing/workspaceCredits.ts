export const WORKSPACE_CREDITS_PATH = '/billing/workspace-credits';
export const WORKSPACE_CREDITS_LIMIT = 50;

export function creditPaymentAmount(amountMinor: number, currency: string): string {
	try {
		const formatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency });
		const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
		return formatter.format(amountMinor / 10 ** digits);
	} catch {
		return `${currency} ${amountMinor} minor units`;
	}
}

export function workspaceCreditsHref(workspaceId: string, customerId?: string): string {
	const query = new URLSearchParams({ workspaceId });
	if (customerId) query.set('customerId', customerId);
	return `${WORKSPACE_CREDITS_PATH}?${query}`;
}

export function workspaceCreditsQuery(workspaceId: string, customerId = '', before = ''): string {
	if (!/^ws_[A-Za-z0-9_-]{1,100}$/.test(workspaceId)) {
		throw new Error('Enter a valid Plaqad workspace ID.');
	}
	if (customerId && !/^cust_[A-Za-z0-9_-]{1,100}$/.test(customerId)) {
		throw new Error('The customer link is invalid. Reopen it from the customer profile.');
	}
	const query = new URLSearchParams({ workspaceId, limit: String(WORKSPACE_CREDITS_LIMIT) });
	if (customerId) query.set('customerId', customerId);
	if (before) query.set('before', before);
	return `/workspace-credits?${query}`;
}
