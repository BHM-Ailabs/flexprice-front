import { ENVIRONMENT_TYPE } from '@/models';
import { describe, expect, it } from 'vitest';
import { buildStripeConnectionCreatePayload, StripeConnectionFormData, validateStripeConnectionForm } from './stripeConnectionForm';

const validForm = (changes: Partial<StripeConnectionFormData> = {}): StripeConnectionFormData => ({
	name: 'Production Stripe',
	publishable_key: 'pk_live_publishable',
	secret_key: 'rk_live_restricted',
	webhook_secret: 'whsec_signing',
	sync_config: { plan: true, subscription: false, invoice: true },
	...changes,
});

describe('Stripe connection form', () => {
	it('requires every credential when creating a connection', () => {
		expect(
			validateStripeConnectionForm(validForm({ name: '', publishable_key: '', secret_key: '', webhook_secret: '' }), {
				requireCredentials: true,
				environmentType: ENVIRONMENT_TYPE.PRODUCTION,
			}),
		).toEqual({
			name: 'Connection name is required.',
			publishable_key: 'Publishable key is required.',
			secret_key: 'Restricted or secret key is required.',
			webhook_secret: 'Webhook signing secret is required.',
		});
	});

	it('rejects invalid key formats and mixed Stripe modes', () => {
		const invalidFormats = validateStripeConnectionForm(
			validForm({ publishable_key: 'publishable', secret_key: 'server', webhook_secret: 'webhook' }),
			{ requireCredentials: true },
		);
		expect(invalidFormats).toMatchObject({
			publishable_key: expect.stringContaining('pk_test_'),
			secret_key: expect.stringContaining('rk_'),
			webhook_secret: expect.stringContaining('whsec_'),
		});

		const mixedModes = validateStripeConnectionForm(validForm({ secret_key: 'sk_test_server' }), {
			requireCredentials: true,
		});
		expect(mixedModes.publishable_key).toContain('same Stripe mode');
		expect(mixedModes.secret_key).toContain('same Stripe mode');
	});

	it('requires live keys in production and test keys in development', () => {
		const productionErrors = validateStripeConnectionForm(
			validForm({ publishable_key: 'pk_test_publishable', secret_key: 'rk_test_restricted' }),
			{ requireCredentials: true, environmentType: ENVIRONMENT_TYPE.PRODUCTION },
		);
		expect(productionErrors.publishable_key).toContain('live-mode');
		expect(productionErrors.secret_key).toContain('live-mode');

		const developmentErrors = validateStripeConnectionForm(validForm(), {
			requireCredentials: true,
			environmentType: ENVIRONMENT_TYPE.DEVELOPMENT,
		});
		expect(developmentErrors.publishable_key).toContain('test-mode');
		expect(developmentErrors.secret_key).toContain('test-mode');
	});

	it('includes the publishable key and trims all credentials in the encrypted payload', () => {
		const payload = buildStripeConnectionCreatePayload(
			validForm({
				name: '  Production Stripe  ',
				publishable_key: '  pk_live_publishable  ',
				secret_key: '  rk_live_restricted  ',
				webhook_secret: '  whsec_signing  ',
			}),
		);

		expect(payload).toMatchObject({
			name: 'Production Stripe',
			provider_type: 'stripe',
			encrypted_secret_data: {
				provider_type: 'stripe',
				publishable_key: 'pk_live_publishable',
				secret_key: 'rk_live_restricted',
				webhook_secret: 'whsec_signing',
			},
			sync_config: {
				plan: { inbound: true, outbound: false },
				subscription: { inbound: false, outbound: false },
				invoice: { inbound: false, outbound: true },
			},
		});
	});
});
