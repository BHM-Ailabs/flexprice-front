import { describe, expect, it } from 'vitest';
import type { CatalogItem, MarkupPolicy } from '@/api/PlaqadBillingApi';
import { creditsAtMarkup, percentBps, previewPrice, uniformPolicy } from './pricing';
import { parseAmountMinor, reviewRecipients } from './invoices';

const item: CatalogItem = {
	sku: 'shared.llm.call',
	product: 'shared',
	displayName: 'Call',
	unit: 'call',
	unitScale: 1,
	usdCostMicro: 5000000,
	creditPrice: 650,
	pricingMode: 'markup',
	pricingClass: 'llm',
	markupBps: 3000,
	active: true,
};
const policy: MarkupPolicy = { basis: 'cost_markup', defaultMarkupBps: 5000, classOverrides: { llm: 3000 }, skuOverrides: {} };

describe('BSP pricing review', () => {
	it('shows $5 at 30%, 50% and 100% as 650, 750 and 1000 credits', () => {
		for (const [percent, credits] of [
			[30, 650],
			[50, 750],
			[100, 1000],
		])
			expect(previewPrice(item, { ...policy, defaultMarkupBps: percentBps(String(percent)), classOverrides: {} })).toBe(credits);
	});
	it('preserves class and SKU precedence unless uniform pricing is explicitly selected', () => {
		expect(previewPrice(item, policy)).toBe(650);
		expect(previewPrice(item, { ...policy, skuOverrides: { [item.sku]: 10000 } })).toBe(1000);
		const zeroCost = { ...item, sku: 'fixed', usdCostMicro: 0, pricingMode: 'fixed' as const, creditPrice: 10 };
		const fixedPositive = { ...item, sku: 'positive-fixed', pricingMode: 'fixed' as const };
		const converted = uniformPolicy([item, zeroCost, fixedPositive], 5000);
		expect(converted.policy.classOverrides).toEqual({});
		expect(converted.policy.skuOverrides).toEqual({});
		expect(converted.items.map((row) => previewPrice(row, converted.policy))).toEqual([750, 10, 750]);
		expect(converted.items[1].pricingMode).toBe('fixed');
	});
	it('rejects malformed, overprecise and out-of-range markups', () => {
		for (const value of ['', '-1', '1000.01', '0.001', 'Infinity', 'wat', '1e2', '0x32']) expect(() => percentBps(value)).toThrow();
		expect(percentBps('30.25')).toBe(3025);
		expect(previewPrice({ ...item, usdCostMicro: 105500 }, { ...policy, classOverrides: { llm: 10000 } })).toBe(22);
	});
	it('rounds exact integer boundaries once without floating-point extra credits', () => {
		expect(creditsAtMarkup(5000000, percentBps('10'))).toBe(550);
		expect(creditsAtMarkup(5000000, percentBps('30'))).toBe(650);
		expect(creditsAtMarkup(5000000, percentBps('30.25'))).toBe(652);
		expect(creditsAtMarkup(1, 0)).toBe(1);
		expect(creditsAtMarkup(0, 5000)).toBe(0);
		for (const [cost, bps] of [
			[-1, 0],
			[1.1, 0],
			[1, NaN],
			[1, 100001],
		])
			expect(() => creditsAtMarkup(cost, bps)).toThrow();
	});
});
describe('prepaid invoice input', () => {
	it('preserves agreed invoice amounts in exact minor units', () => {
		expect(parseAmountMinor('300000')).toBe(30000000);
		expect(parseAmountMinor('1.01')).toBe(101);
		for (const value of ['0', '-10', 'NaN', '0.001', '1e5', '10000000000000000000']) expect(() => parseAmountMinor(value)).toThrow();
	});
	it('deduplicates reviewers and cannot accidentally email the customer during review', () => {
		expect(reviewRecipients('A@example.com, b@example.com; a@example.com', 'customer@example.com')).toEqual([
			'a@example.com',
			'b@example.com',
		]);
		expect(() => reviewRecipients('CUSTOMER@example.com', 'customer@example.com')).toThrow(/customer/i);
		expect(() => reviewRecipients('not-an-email', 'customer@example.com')).toThrow();
	});
});
