import { describe, expect, it } from 'vitest';
import {
	getDefaultWebhookEvents,
	getInvoiceWebhookEvents,
	getPlanWebhookEvents,
	getSubscriptionWebhookEvents,
	StripeWebhookEvents,
} from './StripeWebhookEvents';

describe('Stripe webhook event guidance', () => {
	it('uses only the payment activation lifecycle as the default event set', () => {
		expect(getDefaultWebhookEvents()).toEqual([
			StripeWebhookEvents.CHECKOUT_SESSION_COMPLETED,
			StripeWebhookEvents.CHECKOUT_SESSION_ASYNC_PAYMENT_SUCCEEDED,
			StripeWebhookEvents.CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED,
			StripeWebhookEvents.CHECKOUT_SESSION_EXPIRED,
			StripeWebhookEvents.PAYMENT_INTENT_PAYMENT_FAILED,
		]);

		expect(getDefaultWebhookEvents()).not.toContain(StripeWebhookEvents.CUSTOMER_CREATED);
		expect(getDefaultWebhookEvents()).not.toContain(StripeWebhookEvents.PAYMENT_INTENT_SUCCEEDED);
	});

	it('keeps the optional synchronization event groups intact', () => {
		expect(getPlanWebhookEvents()).toEqual([
			StripeWebhookEvents.PRODUCT_CREATED,
			StripeWebhookEvents.PRODUCT_UPDATED,
			StripeWebhookEvents.PRODUCT_DELETED,
		]);
		expect(getSubscriptionWebhookEvents()).toEqual([
			StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_CREATED,
			StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_UPDATED,
			StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_DELETED,
		]);
		expect(getInvoiceWebhookEvents()).toEqual([StripeWebhookEvents.INVOICE_PAYMENT_PAID, StripeWebhookEvents.SETUP_INTENT_SUCCEEDED]);
	});
});
