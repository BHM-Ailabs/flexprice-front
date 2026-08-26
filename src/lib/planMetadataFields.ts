import { Metadata } from '@/models';
import { isPlanWebsiteMetadataKey } from './planWebsiteSettings';

export interface PlanMetadataFieldValue {
	key: string;
	value: string;
}

export interface PlanMetadataFieldError {
	key?: string;
}

const UNSAFE_METADATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function customPlanMetadataFieldsFromMetadata(metadata: Metadata = {}): PlanMetadataFieldValue[] {
	return Object.entries(metadata)
		.filter(([key]) => !isPlanWebsiteMetadataKey(key))
		.map(([key, value]) => ({ key, value }));
}

export function validatePlanMetadataFields(fields: PlanMetadataFieldValue[]): PlanMetadataFieldError[] {
	const errors: PlanMetadataFieldError[] = fields.map(() => ({}));
	const firstIndexByKey = new Map<string, number>();

	fields.forEach((field, index) => {
		const key = field.key.trim();
		if (!key) {
			if (field.value) errors[index].key = 'Enter a key or remove this field.';
			return;
		}

		if (UNSAFE_METADATA_KEYS.has(key)) {
			errors[index].key = 'This key is reserved for system security.';
			return;
		}

		if (isPlanWebsiteMetadataKey(key)) {
			errors[index].key = 'Use the plan audience and website controls above for this setting.';
			return;
		}

		const firstIndex = firstIndexByKey.get(key);
		if (firstIndex !== undefined) {
			errors[index].key = 'Each metadata key must be unique.';
			if (!errors[firstIndex].key) errors[firstIndex].key = 'Each metadata key must be unique.';
			return;
		}

		firstIndexByKey.set(key, index);
	});

	return errors;
}

export function hasPlanMetadataFieldErrors(errors: PlanMetadataFieldError[]): boolean {
	return errors.some((error) => Boolean(error.key));
}

export function applyCustomPlanMetadataFields(metadata: Metadata = {}, fields: PlanMetadataFieldValue[]): Metadata {
	const next = Object.fromEntries(Object.entries(metadata).filter(([key]) => isPlanWebsiteMetadataKey(key))) as Metadata;

	fields.forEach((field) => {
		const key = field.key.trim();
		if (key && !UNSAFE_METADATA_KEYS.has(key) && !isPlanWebsiteMetadataKey(key)) next[key] = field.value;
	});

	return next;
}
