import { validatePricingSchema } from './validation';
import AiPricingParseApi from '@/api/AiPricingParseApi';
import { PricingSchema } from './types';
import { shouldPersistEntitlement } from './entitlementPolicy';
import { SYSTEM_PROMPT, GEMINI_PRICING_SCHEMA, buildContextualPrompt } from './prompts';

// ============================================
// Schema normalization
// ============================================

export function normalizePricingSchema(schema: PricingSchema): PricingSchema {
	const featureTypeByKey = new Map((schema.features ?? []).map((f) => [f.key, f.type]));

	const plans = (schema.plans ?? []).map((plan) => ({
		...plan,
		prices: (plan.prices ?? []).map((p) => ({
			...p,
			currency: p.currency?.toUpperCase() ?? 'USD',
			billing_period: p.billing_period ?? 'monthly',
		})),
		entitlements: (plan.entitlements ?? [])
			.map((e) => ({
				...e,
				value: e.is_unlimited ? null : (e.value ?? null),
			}))
			.filter((e) => {
				const t = featureTypeByKey.get(e.feature_key);
				if (!t) return false;
				return shouldPersistEntitlement(e, t);
			}),
		usage_charges: (plan.usage_charges ?? []).map((c) => ({
			...c,
			currency: c.currency?.toUpperCase() ?? 'USD',
			billing_model: c.billing_model ?? 'flat_fee',
		})),
	}));

	return {
		...schema,
		features: schema.features ?? [],
		plans,
		credit_grants: schema.credit_grants ?? [],
	};
}

function parseErrMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	if (typeof err === 'string') return err;
	if (err && typeof err === 'object' && 'message' in err) {
		const m = (err as { message: unknown }).message;
		if (typeof m === 'string') return m;
	}
	return 'AI pricing parse failed';
}

// ============================================
// Public entry point
// ============================================

/**
 * Parse a plain-English pricing description into a PricingSchema via Flexprice
 * POST /ai/pricing/parse (same session as other API calls).
 */
export async function parsePricingWithLLM(userPrompt: string, attachmentIDs: string[] = []): Promise<PricingSchema> {
	const enrichedPrompt = buildContextualPrompt(userPrompt);
	try {
		const raw = await AiPricingParseApi.parseGemini({
			systemPrompt: SYSTEM_PROMPT,
			attachment_ids: attachmentIDs,
			userPrompt: enrichedPrompt,
			responseSchema: GEMINI_PRICING_SCHEMA as Record<string, unknown>,
		});
		return normalizePricingSchema(validatePricingSchema(raw));
	} catch (e) {
		throw new Error(parseErrMessage(e));
	}
}
