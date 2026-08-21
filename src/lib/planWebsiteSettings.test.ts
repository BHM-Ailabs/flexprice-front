import { describe, expect, it } from 'vitest';
import { applyPlanWebsiteSettings, planWebsiteSettingsFromMetadata } from './planWebsiteSettings';

describe('plan website settings', () => {
	it('reads the legacy product metadata without requiring JSON', () => {
		expect(
			planWebsiteSettingsFromMetadata({
				public: 'true',
				plaqad_product: 'iq',
				website_features: '["Cited answers"]',
			}),
		).toMatchObject({ public: true, products: ['iq'], features: ['Cited answers'] });
	});

	it('writes structured options while preserving unrelated metadata', () => {
		const result = applyPlanWebsiteSettings(
			{ integration_key: 'keep-me', plaqad_product: 'iq' },
			{
				public: true,
				products: ['iq', 'os'],
				summary: 'For intelligence teams',
				priceLabel: '',
				billingNote: 'Billed monthly',
				badge: '',
				highlight: true,
				displayOrder: '20',
				features: ['Cited answers', 'Scheduled reports'],
				ctaLabel: 'Talk to sales',
				ctaHref: '/contact',
			},
		);

		expect(result).toEqual({
			integration_key: 'keep-me',
			public: 'true',
			plaqad_products: '["iq","os"]',
			website_summary: 'For intelligence teams',
			website_billing_note: 'Billed monthly',
			website_highlight: 'true',
			website_display_order: '20',
			website_features: '["Cited answers","Scheduled reports"]',
			website_cta_label: 'Talk to sales',
			website_cta_href: '/contact',
		});
	});
});
