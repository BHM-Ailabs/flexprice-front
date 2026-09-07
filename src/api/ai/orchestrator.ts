import { INVOICE_CADENCE } from '@/models/Invoice';
import { BILLING_MODEL, BILLING_PERIOD, PRICE_ENTITY_TYPE, PRICE_TYPE, PRICE_UNIT_TYPE } from '@/models/Price';
import { FEATURE_TYPE } from '@/models/Feature';
import { ENTITLEMENT_ENTITY_TYPE, ENTITLEMENT_USAGE_RESET_PERIOD } from '@/models/Entitlement';
import { METER_AGGREGATION_TYPE, METER_USAGE_RESET_PERIOD } from '@/models/Meter';
import { type Metadata } from '@/models';
import { CREDIT_GRANT_CADENCE, CREDIT_GRANT_EXPIRATION_TYPE, CREDIT_GRANT_PERIOD, CREDIT_GRANT_SCOPE } from '@/models/CreditGrant';
import FeatureApi from '@/api/FeatureApi';
import { PlanApi } from '@/api/PlanApi';
import { PriceApi } from '@/api/PriceApi';
import EntitlementApi from '@/api/EntitlementApi';
import CreditGrantApi from '@/api/CreditGrantApi';

import type { PricingSchema, PricingFeature, PricingPlan, PricingPrice, PricingCreditGrant, ProgressCallback } from './types';
import { normalizePricingSchema } from './llm';

// ============================================
// Validation
// ============================================

/** Stamped on plans and features created by the AI pricing orchestrator (values must be strings per Metadata). */
const AI_SETUP_METADATA: Metadata = { created_with_ai: 'true' };

function assertValidPricingSchema(schema: PricingSchema): void {
	if (schema.plans.length === 0) {
		throw new Error('AI response is missing plans. Describe at least one plan or tier.');
	}
}

// ============================================
// Billing period / cadence helpers
// ============================================

function toBillingPeriod(period: PricingPrice['billing_period']): BILLING_PERIOD {
	switch (period) {
		case 'annual':
			return BILLING_PERIOD.ANNUAL;
		case 'one_time':
			return BILLING_PERIOD.ONETIME;
		case 'monthly':
		default:
			return BILLING_PERIOD.MONTHLY;
	}
}

function billingPeriodToResetPeriod(period: PricingPrice['billing_period']): ENTITLEMENT_USAGE_RESET_PERIOD {
	if (period === 'annual') return ENTITLEMENT_USAGE_RESET_PERIOD.ANNUAL;
	if (period === 'one_time') return ENTITLEMENT_USAGE_RESET_PERIOD.NEVER;
	return ENTITLEMENT_USAGE_RESET_PERIOD.MONTHLY;
}

/**
 * Convert an arbitrary plan name to a valid lookup_key slug.
 * Common symbols are expanded to words so "Pro+" → "pro_plus".
 */
function toLookupKey(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/\+/g, '_plus')
			.replace(/@/g, '_at')
			.replace(/&/g, '_and')
			.replace(/%/g, '_percent')
			.replace(/\$/g, '_dollar')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '') || 'plan'
	);
}

/**
 * Build a plan-name → lookup_key map that is guaranteed to be unique within this batch.
 * If two plans normalise to the same slug we append _2, _3, …
 */
function buildUniquePlanLookupKeys(plans: PricingPlan[]): Map<string, string> {
	const nameToKey = new Map<string, string>();
	const usedKeys = new Set<string>();

	for (const plan of plans) {
		const base = toLookupKey(plan.name);
		let candidate = base;
		let counter = 2;

		while (usedKeys.has(candidate)) {
			candidate = `${base}_${counter}`;
			counter++;
		}

		usedKeys.add(candidate);
		nameToKey.set(plan.name, candidate);
	}

	return nameToKey;
}

/** Meter aggregation for createFeature — matches Flexprice event payloads (COUNT vs SUM + field). */
function meterAggregationForFeature(feat: PricingFeature): { type: METER_AGGREGATION_TYPE; field?: string } {
	if (feat.aggregation === 'sum' && feat.aggregation_field?.trim()) {
		return { type: METER_AGGREGATION_TYPE.SUM, field: feat.aggregation_field.trim() };
	}
	return { type: METER_AGGREGATION_TYPE.COUNT };
}

// ============================================
// Credit grant helpers
// ============================================

function pricingCadenceToCreditGrantCadence(c: PricingCreditGrant['cadence']): CREDIT_GRANT_CADENCE {
	return c === 'recurring' ? CREDIT_GRANT_CADENCE.RECURRING : CREDIT_GRANT_CADENCE.ONETIME;
}

function pricingPeriodToCreditGrantPeriod(p: PricingCreditGrant['period'] | null | undefined): CREDIT_GRANT_PERIOD | undefined {
	if (p === 'annual') return CREDIT_GRANT_PERIOD.ANNUAL;
	if (p === 'monthly') return CREDIT_GRANT_PERIOD.MONTHLY;
	return undefined;
}

async function createPlanCreditGrantsIfNeeded(
	grants: PricingCreditGrant[],
	planIdMap: Record<string, string>,
	onProgress?: ProgressCallback,
): Promise<void> {
	if (grants.length === 0) return;

	onProgress?.('creating_credit_grants');

	for (const g of grants) {
		const planId = planIdMap[g.plan_name];
		if (!planId) continue;

		const existingList = await CreditGrantApi.list({ plan_ids: [planId], limit: 100 });
		const cadence = pricingCadenceToCreditGrantCadence(g.cadence);
		const duplicate = existingList.items?.some(
			(cg) => cg.name === g.name && cg.credits === g.credits && cg.cadence === cadence && cg.plan_id === planId,
		);
		if (duplicate) continue;

		const period = pricingPeriodToCreditGrantPeriod(g.period);
		const isRecurring = g.cadence === 'recurring';

		await CreditGrantApi.create({
			name: g.name,
			scope: CREDIT_GRANT_SCOPE.PLAN,
			plan_id: planId,
			credits: g.credits,
			cadence,
			expiration_type: CREDIT_GRANT_EXPIRATION_TYPE.NEVER,
			...(g.conversion_rate != null && g.conversion_rate > 0 ? { conversion_rate: g.conversion_rate } : {}),
			...(isRecurring ? { period: period ?? CREDIT_GRANT_PERIOD.MONTHLY, period_count: 1 } : {}),
		});
	}
}

// ============================================
// Orchestrator — creates all Flexprice entities from a PricingSchema
// ============================================

/** Minimum time each progress step stays visible so the checklist does not flash past. */
const MIN_PROGRESS_STEP_MS = 1900;

async function waitMinStepElapsed(startedAt: number): Promise<void> {
	const elapsed = Date.now() - startedAt;
	if (elapsed < MIN_PROGRESS_STEP_MS) {
		await new Promise<void>((resolve) => setTimeout(resolve, MIN_PROGRESS_STEP_MS - elapsed));
	}
}

export async function orchestrateSetup(schema: PricingSchema, onProgress?: ProgressCallback): Promise<void> {
	const normalized = normalizePricingSchema(schema);
	assertValidPricingSchema(normalized);

	// Check every proposed key before creating anything. AI setup must never append
	// charges or entitlements to an unrelated existing plan, including on retry.
	const planLookupKeys = buildUniquePlanLookupKeys(normalized.plans);
	for (const plan of normalized.plans) {
		const existing = await PlanApi.getPlansByFilter({ limit: 1, lookup_key: planLookupKeys.get(plan.name)! });
		if (existing.items?.length)
			throw new Error(
				`A plan with the key for "${plan.name}" already exists. Review that plan or choose a new name before creating pricing.`,
			);
	}

	const hasEntitlements = normalized.plans.some((p) => p.entitlements.length > 0);
	const hasCreditGrants = (normalized.credit_grants ?? []).length > 0;

	// Step 1 — Create features (upsert: pre-check by lookup_key, create only if missing)
	onProgress?.('creating_features');
	let stepStart = Date.now();
	const featureIdMap: Record<string, string> = {};
	const featureTypeMap: Record<string, FEATURE_TYPE> = {};
	const featureMeterIdMap: Record<string, string> = {};

	for (const feat of normalized.features) {
		const featureType = feat.type === 'metered' ? FEATURE_TYPE.METERED : FEATURE_TYPE.STATIC;

		const existing = await FeatureApi.listFeatures({
			lookup_keys: [feat.key],
			limit: 1,
			expand: 'meters',
		});
		const existingFeature = existing.items?.[0];

		if (existingFeature) {
			if (existingFeature.type !== featureType)
				throw new Error(`Feature "${feat.key}" already exists with a different type. Use its existing type or choose a new key.`);
			featureIdMap[feat.key] = existingFeature.id;
			featureTypeMap[feat.key] = existingFeature.type as FEATURE_TYPE;
			// meter_id is always present on the Feature model; meter?.id only when expand works
			const existingMeterId = existingFeature.meter_id || existingFeature.meter?.id;
			if (existingMeterId) {
				featureMeterIdMap[feat.key] = existingMeterId;
			}
			continue;
		}

		const eventName = feat.meter_event_name?.trim() || feat.key;
		const agg = meterAggregationForFeature(feat);

		const created = await FeatureApi.createFeature({
			name: feat.name,
			lookup_key: feat.key,
			type: featureType,
			metadata: AI_SETUP_METADATA,
			unit_singular: feat.unit_singular,
			unit_plural: feat.unit_plural,
			...(featureType === FEATURE_TYPE.METERED && {
				meter: {
					name: feat.name,
					event_name: eventName,
					aggregation:
						agg.type === METER_AGGREGATION_TYPE.SUM && agg.field
							? { type: METER_AGGREGATION_TYPE.SUM, field: agg.field }
							: { type: METER_AGGREGATION_TYPE.COUNT },
					reset_usage: METER_USAGE_RESET_PERIOD.BILLING_PERIOD,
				},
			}),
		});
		featureIdMap[feat.key] = created.id;
		featureTypeMap[feat.key] = featureType;
		// meter_id is always present on the Feature model; meter?.id only when expand works
		const createdMeterId = created.meter_id || created.meter?.id;
		if (createdMeterId) {
			featureMeterIdMap[feat.key] = createdMeterId;
		}
	}

	await waitMinStepElapsed(stepStart);

	// Step 2 — Create new plans. Surface failures instead of retrying a write
	// under a different key after an ambiguous network response.
	onProgress?.('creating_plans');
	stepStart = Date.now();
	const planIdMap: Record<string, string> = {};
	for (const plan of normalized.plans) {
		const created = await PlanApi.createPlan({
			name: plan.name,
			description: plan.description,
			lookup_key: planLookupKeys.get(plan.name)!,
			metadata: AI_SETUP_METADATA,
		});
		planIdMap[plan.name] = created.id;
	}

	await waitMinStepElapsed(stepStart);

	// Step 3 — Flat subscription prices + usage-based (metered) charges
	onProgress?.('creating_prices');
	stepStart = Date.now();

	for (const plan of normalized.plans) {
		const planId = planIdMap[plan.name];
		if (!planId) continue;

		for (const price of plan.prices) {
			// No $0 recurring advance flat fee — usage-only / free tiers still show $0 on cards via schema.
			const isRecurringFlat = price.billing_period !== 'one_time';
			if (isRecurringFlat && Number(price.amount) === 0) continue;

			await PriceApi.CreatePrice({
				amount: String(price.amount),
				currency: price.currency.toUpperCase(),
				entity_type: PRICE_ENTITY_TYPE.PLAN,
				entity_id: planId,
				type: PRICE_TYPE.FIXED,
				price_unit_type: PRICE_UNIT_TYPE.FIAT,
				// Backend validates BillingPeriod as required for CreatePrice.
				billing_period: toBillingPeriod(price.billing_period),
				billing_period_count: 1,
				billing_model: BILLING_MODEL.FLAT_FEE,
				invoice_cadence: INVOICE_CADENCE.ADVANCE,
			});
		}

		for (const charge of plan.usage_charges ?? []) {
			const meterId = featureMeterIdMap[charge.feature_key];
			if (!meterId) throw new Error(`Meter for "${charge.feature_key}" is missing. Review the feature before creating usage prices.`);

			const isPackage = charge.billing_model === 'package';
			const filterValuesRecord: Record<string, string[]> | undefined =
				charge.filter_values && charge.filter_values.length > 0
					? Object.fromEntries(charge.filter_values.map(({ key, values }) => [key, values]))
					: undefined;

			await PriceApi.CreatePrice({
				amount: String(charge.amount_per_unit),
				currency: charge.currency.toUpperCase(),
				entity_type: PRICE_ENTITY_TYPE.PLAN,
				entity_id: planId,
				type: PRICE_TYPE.USAGE,
				price_unit_type: PRICE_UNIT_TYPE.FIAT,
				billing_period: toBillingPeriod(charge.billing_period),
				billing_period_count: 1,
				billing_model: isPackage ? BILLING_MODEL.PACKAGE : BILLING_MODEL.FLAT_FEE,
				invoice_cadence: INVOICE_CADENCE.ARREAR,
				meter_id: meterId,
				...(isPackage && charge.package_size ? { transform_quantity: { divide_by: charge.package_size, round: 'up' } } : {}),
				...(filterValuesRecord ? { filter_values: filterValuesRecord } : {}),
				...(charge.display_name ? { display_name: charge.display_name } : {}),
			});
		}
	}

	await waitMinStepElapsed(stepStart);

	// Step 4 — Create entitlements (capped metered + static limits only; never unlimited metered)
	if (hasEntitlements) {
		onProgress?.('creating_entitlements');
		stepStart = Date.now();

		for (const plan of normalized.plans) {
			const planId = planIdMap[plan.name];
			if (!planId) continue;
			const planBillingPeriod = plan.prices[0]?.billing_period ?? 'monthly';

			const existingEntitlements = await EntitlementApi.search({
				entity_type: ENTITLEMENT_ENTITY_TYPE.PLAN,
				entity_ids: [planId],
				limit: 100,
			});
			const existingFeatureIds = new Set(existingEntitlements.items?.map((e) => e.feature_id) ?? []);

			for (const ent of plan.entitlements) {
				const featureId = featureIdMap[ent.feature_key];
				const featureType = featureTypeMap[ent.feature_key];
				if (!featureId || !featureType) continue;
				if (existingFeatureIds.has(featureId)) continue;

				const isStatic = featureType === FEATURE_TYPE.STATIC;

				await EntitlementApi.create({
					entity_type: ENTITLEMENT_ENTITY_TYPE.PLAN,
					entity_id: planId,
					feature_id: featureId,
					feature_type: featureType,
					is_enabled: true,
					...(isStatic
						? { static_value: ent.is_unlimited ? 'unlimited' : String(ent.value ?? 'true') }
						: {
								usage_limit: ent.is_unlimited ? null : (ent.value ?? null),
								usage_reset_period: billingPeriodToResetPeriod(planBillingPeriod),
								is_soft_limit: false,
							}),
				});
			}
		}

		await waitMinStepElapsed(stepStart);
	}

	if (hasCreditGrants) {
		stepStart = Date.now();
		await createPlanCreditGrantsIfNeeded(normalized.credit_grants ?? [], planIdMap, onProgress);
		await waitMinStepElapsed(stepStart);
	}

	onProgress?.('done');
}
