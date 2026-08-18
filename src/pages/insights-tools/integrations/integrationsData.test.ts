import { describe, expect, it } from 'vitest';
import { integrations } from './integrationsData';

describe('Paystack integration catalog entry', () => {
	it('is available as a hosted payments connector', () => {
		const paystack = integrations.find((integration) => integration.name === 'Paystack');

		expect(paystack).toMatchObject({ type: 'available' });
		expect(paystack?.premium).toBeUndefined();
		expect(paystack?.tags).toContain('Payments');
		expect(paystack?.description).toContain('Paystack-hosted checkout');
	});
});
