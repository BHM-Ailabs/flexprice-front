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
		).toMatchObject({ public: true, products: ['iq'], features: ['Daily brief'] });
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
	});
});
