/**
 * Enum for Stripe webhook events used in the application
 * This provides type safety and prevents typos when working with webhook events
 */
export enum StripeWebhookEvents {
	// Checkout session events
	CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed',
	CHECKOUT_SESSION_ASYNC_PAYMENT_SUCCEEDED = 'checkout.session.async_payment_succeeded',
	CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED = 'checkout.session.async_payment_failed',
	CHECKOUT_SESSION_EXPIRED = 'checkout.session.expired',

	// Customer events
	CUSTOMER_CREATED = 'customer.created',

	// Payment intent events
	PAYMENT_INTENT_PAYMENT_FAILED = 'payment_intent.payment_failed',
	PAYMENT_INTENT_SUCCEEDED = 'payment_intent.succeeded',

	// Invoice events
	INVOICE_PAYMENT_PAID = 'invoice_payment.paid',
	SETUP_INTENT_SUCCEEDED = 'setup_intent.succeeded',

	// Product events
	PRODUCT_CREATED = 'product.created',
	PRODUCT_UPDATED = 'product.updated',
	PRODUCT_DELETED = 'product.deleted',

	// Subscription events
	CUSTOMER_SUBSCRIPTION_CREATED = 'customer.subscription.created',
	CUSTOMER_SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
	CUSTOMER_SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
}

/**
 * Helper function to get default webhook events
 * @returns Array of default Stripe webhook events
 */
export const getDefaultWebhookEvents = (): StripeWebhookEvents[] => [
	StripeWebhookEvents.CHECKOUT_SESSION_COMPLETED,
	StripeWebhookEvents.CHECKOUT_SESSION_ASYNC_PAYMENT_SUCCEEDED,
	StripeWebhookEvents.CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED,
	StripeWebhookEvents.CHECKOUT_SESSION_EXPIRED,
	StripeWebhookEvents.PAYMENT_INTENT_PAYMENT_FAILED,
];

/**
 * Helper function to get plan-related webhook events
 * @returns Array of plan-related Stripe webhook events
 */
export const getPlanWebhookEvents = (): StripeWebhookEvents[] => [
	StripeWebhookEvents.PRODUCT_CREATED,
	StripeWebhookEvents.PRODUCT_UPDATED,
	StripeWebhookEvents.PRODUCT_DELETED,
];

/**
 * Helper function to get subscription-related webhook events
 * @returns Array of subscription-related Stripe webhook events
 */
export const getSubscriptionWebhookEvents = (): StripeWebhookEvents[] => [
	StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_CREATED,
	StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_UPDATED,
	StripeWebhookEvents.CUSTOMER_SUBSCRIPTION_DELETED,
];

/**
 * Helper function to get invoice-related webhook events
 * @returns Array of invoice-related Stripe webhook events
 */
export const getInvoiceWebhookEvents = (): StripeWebhookEvents[] => [
	StripeWebhookEvents.INVOICE_PAYMENT_PAID,
	StripeWebhookEvents.SETUP_INTENT_SUCCEEDED,
];
