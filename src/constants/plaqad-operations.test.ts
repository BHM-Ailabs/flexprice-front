import { describe, expect, it } from 'vitest';

import { PLAQAD_OPERATION_DESCRIPTIONS_BY_PRODUCT, PLAQAD_OPERATION_KEYS_BY_PRODUCT, getPlaqadOperationOptions } from './plaqad-operations';
import { PLAQAD_PRODUCT_OPTIONS } from './plaqad';

const EXPECTED_OPERATION_COUNTS = {
	iq: 4,
	ba: 0,
	studio: 9,
	os: 7,
	pa: 8,
	talent: 8,
	intel: 101,
	scout: 0,
	people: 0,
	maestro: 11,
} as const;

describe('Plaqad operation registry', () => {
	it('defines an operation collection for every selectable product', () => {
		expect(Object.keys(PLAQAD_OPERATION_KEYS_BY_PRODUCT).sort()).toEqual(PLAQAD_PRODUCT_OPTIONS.map(({ value }) => value).sort());
	});

	it.each(Object.entries(EXPECTED_OPERATION_COUNTS))('keeps the reviewed %s operation count at %i', (product, expectedCount) => {
		const operationKeys = PLAQAD_OPERATION_KEYS_BY_PRODUCT[product as keyof typeof PLAQAD_OPERATION_KEYS_BY_PRODUCT];

		expect(operationKeys).toHaveLength(expectedCount);
		expect(new Set(operationKeys).size).toBe(expectedCount);
	});

	it('builds exact operation and lookup-key choices for the selected product', () => {
		expect(getPlaqadOperationOptions('talent')).toContainEqual({
			value: 'cv_parse',
			label: 'cv_parse',
			description: 'One Talent CV parsing run.',
			supportingText: 'plaqad:talent:cv_parse',
		});
		expect(getPlaqadOperationOptions('intel')).toContainEqual({
			value: 'firecrawl:news',
			label: 'firecrawl:news',
			description: 'Provider-backed news search used as a resilient ingestion and backfill source.',
			supportingText: 'plaqad:intel:firecrawl:news',
		});
	});

	it.each(Object.keys(EXPECTED_OPERATION_COUNTS))('documents every registered %s operation', (product) => {
		const operationKeys = PLAQAD_OPERATION_KEYS_BY_PRODUCT[product as keyof typeof PLAQAD_OPERATION_KEYS_BY_PRODUCT];
		const descriptions = PLAQAD_OPERATION_DESCRIPTIONS_BY_PRODUCT[product as keyof typeof PLAQAD_OPERATION_DESCRIPTIONS_BY_PRODUCT];

		expect(Object.keys(descriptions).sort()).toEqual([...operationKeys].sort());
		for (const description of Object.values(descriptions)) {
			expect(description.trim().length).toBeGreaterThan(0);
		}
	});

	it('returns no choices before a valid product is selected', () => {
		expect(getPlaqadOperationOptions('')).toEqual([]);
		expect(getPlaqadOperationOptions('unknown-product')).toEqual([]);
	});
});
