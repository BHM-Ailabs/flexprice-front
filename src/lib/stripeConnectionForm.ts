import { CONNECTION_PROVIDER_TYPE, ENVIRONMENT_TYPE } from '@/models';
import { CreateConnectionPayload } from '@/types/dto';

export type StripeKeyMode = 'test' | 'live';

export interface StripeConnectionFormData {
	name: string;
	publishable_key: string;
	secret_key: string;
	webhook_secret: string;
	sync_config: {
		plan: boolean;
		subscription: boolean;
		invoice: boolean;
	};
}

export type StripeConnectionFormErrors = Partial<Record<'name' | 'publishable_key' | 'secret_key' | 'webhook_secret', string>>;

const publishableKeyPattern = /^pk_(test|live)_\S+$/;
const serverKeyPattern = /^(?:rk|sk)_(test|live)_\S+$/;
const webhookSecretPattern = /^whsec_\S+$/;

export function stripePublishableKeyMode(value: string): StripeKeyMode | null {
	const match = value.trim().match(publishableKeyPattern);
	return (match?.[1] as StripeKeyMode | undefined) ?? null;
}

export function stripeServerKeyMode(value: string): StripeKeyMode | null {
	const match = value.trim().match(serverKeyPattern);
	return (match?.[1] as StripeKeyMode | undefined) ?? null;
}

export function expectedStripeMode(environmentType?: ENVIRONMENT_TYPE): StripeKeyMode | null {
	if (environmentType === ENVIRONMENT_TYPE.PRODUCTION) return 'live';
	if (environmentType === ENVIRONMENT_TYPE.DEVELOPMENT) return 'test';
	return null;
}

export function validateStripeConnectionForm(
	formData: StripeConnectionFormData,
	options: { requireCredentials: boolean; environmentType?: ENVIRONMENT_TYPE },
): StripeConnectionFormErrors {
	const errors: StripeConnectionFormErrors = {};

	if (!formData.name.trim()) errors.name = 'Connection name is required.';
	if (!options.requireCredentials) return errors;

	const publishableKey = formData.publishable_key.trim();
	const serverKey = formData.secret_key.trim();
	const webhookSecret = formData.webhook_secret.trim();

	if (!publishableKey) errors.publishable_key = 'Publishable key is required.';
	else if (!publishableKeyPattern.test(publishableKey)) {
		errors.publishable_key = 'Enter a valid Stripe publishable key beginning with pk_test_ or pk_live_.';
	}

	if (!serverKey) errors.secret_key = 'Restricted or secret key is required.';
	else if (!serverKeyPattern.test(serverKey)) {
		errors.secret_key = 'Enter a valid Stripe restricted or secret key beginning with rk_ or sk_.';
	}

	if (!webhookSecret) errors.webhook_secret = 'Webhook signing secret is required.';
	else if (!webhookSecretPattern.test(webhookSecret)) {
		errors.webhook_secret = 'Enter a valid Stripe webhook signing secret beginning with whsec_.';
	}

	const publishableMode = stripePublishableKeyMode(publishableKey);
	const serverMode = stripeServerKeyMode(serverKey);
	if (publishableMode && serverMode && publishableMode !== serverMode) {
		errors.publishable_key = 'Publishable and server keys must both use the same Stripe mode.';
		errors.secret_key = 'Publishable and server keys must both use the same Stripe mode.';
	}

	const environmentMode = expectedStripeMode(options.environmentType);
	if (environmentMode && publishableMode && publishableMode !== environmentMode) {
		errors.publishable_key = `Use a ${environmentMode}-mode publishable key in this ${options.environmentType} environment.`;
	}
	if (environmentMode && serverMode && serverMode !== environmentMode) {
		errors.secret_key = `Use a ${environmentMode}-mode restricted or secret key in this ${options.environmentType} environment.`;
	}

	return errors;
}

export function buildStripeConnectionCreatePayload(formData: StripeConnectionFormData): CreateConnectionPayload {
	return {
		name: formData.name.trim(),
		provider_type: CONNECTION_PROVIDER_TYPE.STRIPE,
		encrypted_secret_data: {
			provider_type: CONNECTION_PROVIDER_TYPE.STRIPE,
			publishable_key: formData.publishable_key.trim(),
			secret_key: formData.secret_key.trim(),
			webhook_secret: formData.webhook_secret.trim(),
		},
		sync_config: {
			plan: {
				inbound: formData.sync_config.plan,
				outbound: false,
			},
			subscription: {
				inbound: formData.sync_config.subscription,
				outbound: false,
			},
			invoice: {
				inbound: false,
				outbound: formData.sync_config.invoice,
			},
		},
	};
}
