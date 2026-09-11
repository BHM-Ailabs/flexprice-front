import { Invoice, Pagination, Metadata } from '@/models';
import { TaxRateOverride } from './tax';
import { TypedBackendFilter, TypedBackendSort } from '@/types/formatters/QueryBuilder';

export interface GetInvoicesResponse {
	items: Invoice[];
	pagination: Pagination;
}

/**
 * Filter for listing/searching invoices. Matches backend InvoiceFilter.
 * Used for both GET /invoices (query params) and POST /invoices/search (body).
 */
export interface InvoiceFilter {
	// Query/pagination (GET uses sort_field + order; POST uses sort array)
	limit?: number;
	offset?: number;
	sort_field?: string;
	order?: string;
	status?: string;
	expand?: string;
	search?: string;
	// Time range
	start_time?: string;
	end_time?: string;
	// Generic filters (POST search uses arrays)
	filters?: TypedBackendFilter[];
	sort?: TypedBackendSort[];
	// Dedicated filter fields
	invoice_ids?: string[];
	customer_id?: string;
	external_customer_id?: string;
	currency?: string;
	subscription_id?: string;
	subscription_customer_id?: string;
	invoice_type?: string;
	invoice_status?: string[];
	payment_status?: string[];
	amount_due_gt?: number;
	amount_remaining_gt?: number;
	reporting_date_gte?: string;
	reporting_date_lt?: string;
	period_start_gte?: string;
	period_start_lte?: string;
	period_end_gte?: string;
	period_end_lte?: string;
	skip_line_items?: boolean;
}

/** Request body for PUT /invoices/:id/payment (update payment status). */
export interface UpdatePaymentStatusPayload {
	payment_status: string;
	amount?: number;
}

export interface UpdateInvoiceStatusPayload {
	invoiceId: string;
	payment_status?: string;
	amount?: number;
}

export interface GetInvoicePreviewPayload {
	period_end: string;
	period_start: string;
	subscription_id: string;
	hide_zero_charges_line_items?: boolean;
}

// InvoiceCoupon represents a coupon to be applied at the invoice level
export interface InvoiceCoupon {
	coupon_id: string;
	coupon_association_id?: string;
}

// InvoiceLineItemCoupon represents a coupon applied to a specific invoice line item
export interface InvoiceLineItemCoupon {
	line_item_id: string; // price_id used to match the line item
	coupon_id: string;
	coupon_association_id?: string;
}

export interface CreateInvoiceLineItemRequest {
	entity_id?: string;
	entity_type?: string;
	price_id?: string;
	plan_display_name?: string;
	price_type?: string;
	meter_id?: string;
	meter_display_name?: string;
	price_unit?: string;
	price_unit_amount?: number;
	display_name?: string;
	amount: number;
	quantity: string;
	period_start?: string;
	period_end?: string;
	metadata?: Metadata;
	plan_id?: string; // TODO: !REMOVE after migration
	commitment_info?: {
		commitment_amount?: number;
		commitment_quantity?: number;
		commitment_type?: string;
		overage_factor?: number;
		enable_true_up?: boolean;
		is_window_commitment?: boolean;
	};
	prepaid_credits_applied?: number; // prepaid credits applied to this line item
	line_item_discount?: number; // discount applied directly to this line item
}

export interface CreateInvoicePayload {
	// Optional human-readable identifier for the invoice
	invoice_number?: string;

	// Required: unique identifier of the customer this invoice belongs to
	customer_id: string;

	// Optional: unique identifier of the subscription associated with this invoice
	subscription_id?: string;

	// Optional: key used to prevent duplicate invoice creation
	idempotency_key?: string;

	// Required: type of invoice (subscription, one_time, etc.)
	invoice_type: string;

	// Required: three-letter ISO currency code (e.g., USD, EUR)
	currency: string;

	// Required: total amount that needs to be paid for this invoice
	amount_due: number;

	// Required: total amount of the invoice including taxes and discounts
	total: number;

	// Required: amount before taxes and discounts are applied
	subtotal: number;

	// Optional: text description of the invoice
	description?: string;

	// Optional: date by which payment is expected (ISO string)
	due_date?: string;

	// Optional: period this invoice covers (e.g., "monthly", "yearly")
	billing_period?: string;

	// Optional: start date of the billing period (ISO string)
	period_start?: string;

	// Optional: end date of the billing period (ISO string)
	period_end?: string;

	// Required: why this invoice was created (subscription_cycle, manual, etc.)
	billing_reason: string;

	// Optional: current status of the invoice (draft, finalized, etc.)
	invoice_status?: string;

	// Optional: payment status of the invoice (unpaid, paid, etc.)
	payment_status?: string;

	// Optional: amount that has been paid towards this invoice
	amount_paid?: number;

	// Optional: individual items that make up this invoice
	line_items?: CreateInvoiceLineItemRequest[];

	// Optional: additional custom key-value pairs for storing extra information
	metadata?: Metadata;

	// Optional: unique identifier of the environment this invoice belongs to
	environment_id?: string;

	// Optional: unique identifier of the coupons applied to this invoice (legacy)
	coupons?: string[];

	// Optional: invoice-level coupons
	invoice_coupons?: InvoiceCoupon[];

	// Optional: line-item-level coupons
	line_item_coupons?: InvoiceLineItemCoupon[];

	// Optional: total prepaid credits applied to this invoice
	total_prepaid_applied?: number;

	// Optional: tax rate overrides to apply on this invoice
	tax_rate_overrides?: TaxRateOverride[];
}

export interface GetInvoicePdfPayload {
	invoice_id: string;
	invoice_no?: string;
}

export interface VoidInvoicePayload {
	metadata?: Metadata;
}

/** Response for POST /invoices/:id/recalculate (202 Accepted) — async workflow started */
export interface RecalculateInvoiceResponse {
	message: string;
	workflow_id: string;
	run_id: string;
}
