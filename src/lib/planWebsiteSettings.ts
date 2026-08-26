import { Metadata } from '@/models';

export const PLAN_WEBSITE_METADATA_KEYS = [
	'public',
	'plaqad_products',
	'plaqad_product',
	'website_summary',
	'website_price_label',
	'website_billing_note',
	'website_badge',
	'website_highlight',
	'website_display_order',
	'website_features',
	'website_cta_action',
	'website_cta_label',
	'website_cta_href',
] as const;

const PLAN_WEBSITE_METADATA_KEY_SET = new Set<string>(PLAN_WEBSITE_METADATA_KEYS);

export const isPlanWebsiteMetadataKey = (key: string): boolean => PLAN_WEBSITE_METADATA_KEY_SET.has(key);

export type PlanWebsiteCtaAction = 'auto' | 'subscribe' | 'sales' | 'custom';

export interface PlanWebsiteSettings {
	public: boolean;
	products: string[];
	summary: string;
	priceLabel: string;
	billingNote: string;
	badge: string;
	highlight: boolean;
	displayOrder: string;
	features: string[];
	ctaAction: PlanWebsiteCtaAction;
	ctaLabel: string;
	ctaHref: string;
}

const optionalString = (value: string | undefined) => value?.trim() ?? '';

const ctaAction = (metadata: Metadata): PlanWebsiteCtaAction => {
	const configured = optionalString(metadata.website_cta_action);
	if (configured === 'subscribe' || configured === 'sales' || configured === 'custom') return configured;

	const legacyPath = optionalString(metadata.website_cta_href);
	if (legacyPath === '/contact') return 'sales';
	if (legacyPath) return 'custom';
	return 'auto';
};

const stringList = (value: string | undefined): string[] => {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim());
	} catch {
		return [];
	}
};

export function planWebsiteSettingsFromMetadata(metadata: Metadata = {}): PlanWebsiteSettings {
	const configuredProducts = stringList(metadata.plaqad_products);
	const legacyProduct = optionalString(metadata.plaqad_product);
	return {
		public: metadata.public === 'true',
		products: configuredProducts.length > 0 ? configuredProducts : legacyProduct ? [legacyProduct] : [],
		summary: optionalString(metadata.website_summary),
		priceLabel: optionalString(metadata.website_price_label),
		billingNote: optionalString(metadata.website_billing_note),
		badge: optionalString(metadata.website_badge),
		highlight: metadata.website_highlight === 'true',
		displayOrder: optionalString(metadata.website_display_order),
		features: stringList(metadata.website_features),
		ctaAction: ctaAction(metadata),
		ctaLabel: optionalString(metadata.website_cta_label),
		ctaHref: optionalString(metadata.website_cta_href),
	};
}

function setOptional(metadata: Metadata, key: string, value: string): void {
	const normalized = value.trim();
	if (normalized) metadata[key] = normalized;
	else delete metadata[key];
}

export function applyPlanWebsiteSettings(metadata: Metadata = {}, settings: PlanWebsiteSettings): Metadata {
	const next = { ...metadata };
	next.public = settings.public ? 'true' : 'false';

	if (settings.products.length > 0) {
		next.plaqad_products = JSON.stringify(settings.products);
		if (settings.products.length === 1) next.plaqad_product = settings.products[0];
		else delete next.plaqad_product;
	} else {
		delete next.plaqad_products;
		delete next.plaqad_product;
	}

	setOptional(next, 'website_summary', settings.summary);
	setOptional(next, 'website_price_label', settings.priceLabel);
	setOptional(next, 'website_billing_note', settings.billingNote);
	setOptional(next, 'website_badge', settings.badge);
	setOptional(next, 'website_display_order', settings.displayOrder);
	setOptional(next, 'website_cta_label', settings.ctaLabel);

	if (settings.ctaAction === 'auto') delete next.website_cta_action;
	else next.website_cta_action = settings.ctaAction;

	if (settings.ctaAction === 'custom') setOptional(next, 'website_cta_href', settings.ctaHref);
	else delete next.website_cta_href;

	if (settings.features.length > 0) next.website_features = JSON.stringify(settings.features);
	else delete next.website_features;

	if (settings.highlight) next.website_highlight = 'true';
	else delete next.website_highlight;

	return next;
}
