export function parseAmountMinor(value: string): number {
	if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a positive invoice amount with up to two decimal places.');
	const [whole, fraction = ''] = value.trim().split('.');
	const amount = Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
	if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000000)
		throw new Error('The invoice amount must be positive and within the supported range.');
	return amount;
}
export function reviewRecipients(value: string, customerEmail: string): string[] {
	const recipients = [
		...new Set(
			value
				.split(/[,;\s]+/)
				.map((email) => email.trim().toLowerCase())
				.filter(Boolean),
		),
	];
	if (!recipients.length || recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
		throw new Error('Enter valid review email addresses, separated by commas.');
	if (recipients.includes(customerEmail.toLowerCase()))
		throw new Error('The customer cannot receive a review copy. Remove their address from the review recipients.');
	return recipients;
}
export const invoiceMoney = (amountMinor: number, currency: string) =>
	new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amountMinor / 100);

export function paymentLink(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		const trusted = url.hostname === 'paystack.com' || url.hostname.endsWith('.paystack.com') || url.hostname === 'checkout.stripe.com';
		return url.protocol === 'https:' && trusted && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}
