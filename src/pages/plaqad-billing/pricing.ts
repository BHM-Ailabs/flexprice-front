import type { CatalogItem, MarkupPolicy } from '@/api/PlaqadBillingApi';

export const initialPolicy: MarkupPolicy = { basis: 'cost_markup', defaultMarkupBps: 5000, classOverrides: {}, skuOverrides: {} };
export function percentBps(value: string): number {
	const text = value.trim();
	if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
		throw new Error('Enter a markup from 0% to 1000%, with at most two decimal places.');
	}
	const [whole, fraction = ''] = text.split('.');
	const bps = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
	if (bps > 100000n) throw new Error('Enter a markup from 0% to 1000%, with at most two decimal places.');
	return Number(bps);
}
export function resolvedBps(item: CatalogItem, policy: MarkupPolicy): number | null {
	return item.pricingMode === 'markup'
		? (policy.skuOverrides[item.sku] ?? policy.classOverrides[item.pricingClass] ?? policy.defaultMarkupBps)
		: null;
}
export function previewPrice(item: CatalogItem, policy: MarkupPolicy): number {
	const bps = resolvedBps(item, policy);
	if (bps === null) return item.creditPrice;
	return creditsAtMarkup(item.usdCostMicro, bps);
}
export function creditsAtMarkup(usdCostMicro: number, markupBps: number): number {
	if (!Number.isSafeInteger(usdCostMicro) || usdCostMicro < 0 || !Number.isSafeInteger(markupBps) || markupBps < 0 || markupBps > 100000)
		throw new Error('Provider cost and markup must be valid whole microdollars and basis points.');
	const amount = BigInt(usdCostMicro) * BigInt(10000 + markupBps);
	return Number((amount + 99999999n) / 100000000n);
}
export function uniformPolicy(items: CatalogItem[], markupBps: number) {
	return {
		policy: { basis: 'cost_markup' as const, defaultMarkupBps: markupBps, classOverrides: {}, skuOverrides: {} },
		items: items.map((item) =>
			item.usdCostMicro > 0
				? { ...item, pricingMode: 'markup' as const, pricingClass: item.pricingClass || 'custom', markupBps }
				: { ...item, pricingMode: 'fixed' as const, markupBps: null },
		),
	};
}
