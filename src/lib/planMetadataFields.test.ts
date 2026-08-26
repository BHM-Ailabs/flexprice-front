import { describe, expect, it } from 'vitest';
import {
	applyCustomPlanMetadataFields,
	customPlanMetadataFieldsFromMetadata,
	hasPlanMetadataFieldErrors,
	validatePlanMetadataFields,
} from './planMetadataFields';

describe('plan metadata fields', () => {
	it('shows unrelated metadata as fields while structured website keys stay hidden', () => {
		expect(
			customPlanMetadataFieldsFromMetadata({
				public: 'false',
				website_summary: 'Enterprise agreement',
				contract_reference: 'ENT-1042',
				crm_segment: 'strategic',
			}),
		).toEqual([
			{ key: 'contract_reference', value: 'ENT-1042' },
			{ key: 'crm_segment', value: 'strategic' },
		]);
	});

	it('preserves structured settings and unknown metadata in the string payload', () => {
		const metadata = applyCustomPlanMetadataFields(
			{
				public: 'true',
				plaqad_products: '["iq"]',
				contract_reference: 'old',
			},
			[
				{ key: 'contract_reference', value: 'ENT-1042' },
				{ key: 'crm_segment', value: 'strategic' },
			],
		);

		expect(metadata).toEqual({
			public: 'true',
			plaqad_products: '["iq"]',
			contract_reference: 'ENT-1042',
			crm_segment: 'strategic',
		});
		expect(Object.values(metadata).every((value) => typeof value === 'string')).toBe(true);
	});

	it('ignores a completely blank row', () => {
		expect(
			applyCustomPlanMetadataFields({ public: 'false' }, [
				{ key: '', value: '' },
				{ key: '__proto__', value: 'unsafe' },
			]),
		).toEqual({ public: 'false' });
		expect(hasPlanMetadataFieldErrors(validatePlanMetadataFields([{ key: '', value: '' }]))).toBe(false);
	});

	it('rejects missing, duplicate, structured, and unsafe keys', () => {
		const errors = validatePlanMetadataFields([
			{ key: '', value: 'orphaned value' },
			{ key: 'crm_segment', value: 'one' },
			{ key: 'crm_segment', value: 'two' },
			{ key: 'public', value: 'true' },
			{ key: '__proto__', value: 'unsafe' },
		]);

		expect(errors.map((error) => error.key)).toEqual([
			'Enter a key or remove this field.',
			'Each metadata key must be unique.',
			'Each metadata key must be unique.',
			'Use the plan audience and website controls above for this setting.',
			'This key is reserved for system security.',
		]);
		expect(hasPlanMetadataFieldErrors(errors)).toBe(true);
	});
});
