import { describe, expect, it } from 'vitest';
import { validatePricingSchema } from './validation';
const valid = () => ({
	features: [],
	plans: [{ name: 'Pro', description: '', prices: [{ amount: 29, currency: 'USD', billing_period: 'monthly' }], entitlements: [] }],
});
describe('AI pricing validation', () => {
	it('accepts flat pricing without inventing features', () => {
		expect(validatePricingSchema(valid()).plans[0].prices[0].amount).toBe(29);
	});
	it.each([null, [], {}, { features: [], plans: [] }])('rejects malformed model responses', (raw) => {
		expect(() => validatePricingSchema(raw)).toThrow('AI pricing needs correction');
	});
	it('rejects negative money and unknown feature references', () => {
		const raw = valid();
		raw.plans[0].prices[0].amount = -1;
		expect(() => validatePricingSchema(raw)).toThrow();
		expect(() =>
			validatePricingSchema({
				...valid(),
				plans: [{ ...valid().plans[0], entitlements: [{ feature_key: 'missing', is_unlimited: true, value: null }] }],
			}),
		).toThrow();
	});
	it('rejects duplicate names and invalid currency', () => {
		expect(() => validatePricingSchema({ ...valid(), plans: [valid().plans[0], valid().plans[0]] })).toThrow();
		const raw = valid();
		raw.plans[0].prices[0].currency = 'dollars';
		expect(() => validatePricingSchema(raw)).toThrow();
	});
});
