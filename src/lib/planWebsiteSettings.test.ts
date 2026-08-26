import { describe, expect, it } from 'vitest';
import { applyPlanWebsiteSettings, planWebsiteSettingsFromMetadata } from './planWebsiteSettings';

describe('plan website settings', () => {
	it('reads legacy single-product metadata', () => {
		expect(
			planWebsiteSettingsFromMetadata({
				public: 'true',
				plaqad_product: 'iq',
				website_features: '["Daily brief"]',
			}),
		).toMatchObject({ public: true, products: ['iq'], features: ['Daily brief'], ctaAction: 'auto' });
	});

	it('converts legacy button paths into structured actions', () => {
		expect(planWebsiteSettingsFromMetadata({ website_cta_href: '/contact' }).ctaAction).toBe('sales');
		expect(planWebsiteSettingsFromMetadata({ website_cta_href: '/products/iq' }).ctaAction).toBe('custom');
	});

	it('writes structured multi-product settings without disturbing unrelated metadata', () => {
		const current = planWebsiteSettingsFromMetadata({ source: 'operator' });
		const metadata = applyPlanWebsiteSettings(
			{ source: 'operator' },
			{
				...current,
				public: true,
				products: ['iq', 'studio'],
				summary: 'For intelligence teams',
				features: ['Daily brief', 'Shared workspace'],
			},
		);

		expect(metadata).toMatchObject({
			source: 'operator',
			public: 'true',
			plaqad_products: '["iq","studio"]',
			website_summary: 'For intelligence teams',
			website_features: '["Daily brief","Shared workspace"]',
		});
		expect(metadata.plaqad_product).toBeUndefined();
		expect(metadata.website_cta_action).toBeUndefined();
		expect(metadata.website_cta_href).toBeUndefined();
	});

	it('writes self-service and custom button actions without requiring metadata editing', () => {
		const current = planWebsiteSettingsFromMetadata({ source: 'operator', website_cta_href: '/old-path' });
		const selfService = applyPlanWebsiteSettings(
			{ source: 'operator', website_cta_href: '/old-path' },
			{ ...current, ctaAction: 'subscribe' },
		);

		expect(selfService).toMatchObject({ source: 'operator', website_cta_action: 'subscribe' });
		expect(selfService.website_cta_href).toBeUndefined();

		const custom = applyPlanWebsiteSettings(selfService, {
			...current,
			ctaAction: 'custom',
			ctaHref: '/products/iq',
		});
		expect(custom).toMatchObject({
			source: 'operator',
			website_cta_action: 'custom',
			website_cta_href: '/products/iq',
		});
	});
});
