import { PRICING_TEMPLATES } from './templates';

// ============================================
// System prompt — sent to Flexprice /ai/pricing/parse-gemini (Gemini on the server)
// ============================================

export const SYSTEM_PROMPT = `You are a pricing architect for Plaqad BSP, a usage-based billing platform.
Convert the user's pricing description into the exact JSON schema. Return ONLY valid JSON — no markdown, no commentary.

## Features
- type "metered": usage tracked per event (voice minutes, tokens, API calls, searches, exports).
- type "static": on/off capability or seat count.
- key: snake_case lookup key (e.g. "voice_minutes", "input_tokens", "contact_search").
- meter_event_name: exact event name sent to the Plaqad BSP events API. Dots OK (e.g. "call.minutes").
  Defaults to key if omitted.
- aggregation + aggregation_field:
  - "count": each event = 1 unit (API calls, searches, exports, messages counted individually).
  - "sum" + aggregation_field: sum a numeric property on the event payload.
    Voice — events send { "minutes": 5.5 } → aggregation "sum", aggregation_field "minutes".
    Tokens — events send { "input_tokens": 1500 } → aggregation "sum", aggregation_field "input_tokens".

## plans[].prices[]
One plan per tier. prices[] = flat recurring or one-time subscription fees only (not usage).
- Free plan or PAYG (no platform fee): prices: [{ amount: 0, currency: "USD", billing_period: "monthly" }]
- billing_period: "monthly" | "annual" | "one_time"

## plans[].usage_charges[] — MANDATORY for every metered feature that has a per-unit charge
usage_charges attach a meter to a price on a plan. They are what makes usage-based billing work.
Never omit them when there is a per-unit rate described. Every plan that uses a metered feature
MUST have a usage_charge for it.

### Flat-fee per unit (Vapi, standard API metering, Resend overage):
  billing_model: "flat_fee"
  amount_per_unit: dollars per 1 unit
  Example — $0.05 per voice call minute:
    { feature_key: "voice_minutes", amount_per_unit: 0.05, currency: "USD",
      billing_period: "monthly", billing_model: "flat_fee", package_size: null,
      filter_values: null, display_name: null }
  Example — $0.005 per SMS message:
    { feature_key: "sms_messages", amount_per_unit: 0.005, currency: "USD",
      billing_period: "monthly", billing_model: "flat_fee", package_size: null,
      filter_values: null, display_name: null }

### Package / per-N units (Gemini-style per-million-token pricing):
  billing_model: "package"
  package_size: N (number of units per package)
  amount_per_unit: dollars per package (human-readable, e.g. 2.00 for $2/1M tokens)
  filter_values: array of { key, values } for model/variant routing (or null)
  Example — $2.00 per 1 M input tokens for gemini-3.1-pro standard:
    { feature_key: "input_tokens", amount_per_unit: 2.00, currency: "USD",
      billing_period: "monthly", billing_model: "package", package_size: 1000000,
      filter_values: [{ key: "model", values: ["gemini-3.1-pro"] }, { key: "batch", values: ["false"] }],
      display_name: "Gemini 3.1 Pro Input (Standard)" }
  Example — $1.00 per 1 M input tokens batch (50% off):
    { feature_key: "input_tokens", amount_per_unit: 1.00, currency: "USD",
      billing_period: "monthly", billing_model: "package", package_size: 1000000,
      filter_values: [{ key: "model", values: ["gemini-3.1-pro"] }, { key: "batch", values: ["true"] }],
      display_name: "Gemini 3.1 Pro Input (Batch)" }

### Credit-based actions (Apollo-style):
  billing_model: "flat_fee"
  amount_per_unit: CREDIT COST of the action (not dollars — 1 credit, 5 credits, 10 credits)
  currency: "USD"
  EVERY plan MUST have a usage_charge for EVERY metered action feature.
  Example — contact search costs 1 credit, phone reveal costs 10 credits:
    { feature_key: "contact_search", amount_per_unit: 1, currency: "USD",
      billing_period: "monthly", billing_model: "flat_fee", package_size: null,
      filter_values: null, display_name: null }
    { feature_key: "phone_reveal", amount_per_unit: 10, currency: "USD",
      billing_period: "monthly", billing_model: "flat_fee", package_size: null,
      filter_values: null, display_name: null }

## plans[].entitlements[] — ONLY real limits (usually empty)
Do NOT add an entitlement row per feature. Use entitlements: [] unless the plan has a finite limit to enforce.
- **Metered with included quota** (hybrid / overage): one row per capped meter: is_unlimited: false, value: <included units per period>. Overage is priced via usage_charges.
- **Static** (seats, flags, concurrency): include a row only when there is a numeric/static limit (e.g. lines of concurrency, 0/1 feature flags).
- **Never** for "unlimited" metered usage: omit those features from entitlements entirely. PAYG, token billing, and credit-pool plans normally have entitlements: [] — limits come from usage prices + credit_grants, not unlimited entitlement rows.

## Billing patterns (choose the right one)

### Pure usage / PAYG (Vapi, no monthly fee):
  prices: [{ amount: 0 }]
  usage_charges: one entry per metered feature with its dollar rate per unit.
  entitlements: [] unless you have static limits (e.g. concurrency caps).

### Hybrid (flat fee + usage overage):
  prices: flat monthly amount.
  usage_charges: overage rate per unit above included quantity.
  entitlements: only capped metered features, value = included quantity per period.

### Credit pool (Apollo-style):
  prices: flat monthly amount.
  usage_charges: one entry per metered action, amount_per_unit = credit cost of that action.
  credit_grants: recurring monthly credits for the plan allowance.
  entitlements: [] (wallet credits enforce spend; no unlimited meter entitlements).

### Per-model token pricing (Gemini-style):
  features: one per token dimension (input_tokens, output_tokens), SUM aggregation.
  usage_charges: one entry per model × direction × batch variant using package billing.
  For the free tier plan: usage_charges with amount_per_unit 0 for free models.
  filter_values routes each price to the correct model and batch mode.
  entitlements: [] (billing is entirely via usage_charges).

## credit_grants[]
- Recurring plan grants: cadence "recurring", period "monthly", period_count 1.
- conversion_rate: plan_price / credits (omit or 0 for free tiers).
- One-time dollar trial credits: cadence "onetime", credits = dollar amount, conversion_rate 1.`;

// ============================================
// Structured output schema — forwarded in parse-gemini request body (Gemini API shape)
// ============================================

// Uses { type: "number", nullable: true } — Gemini does NOT support type arrays like ["number","null"]
export const GEMINI_PRICING_SCHEMA = {
	type: 'object',
	properties: {
		features: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					key: { type: 'string' },
					type: { type: 'string', enum: ['static', 'metered'] },
					unit_singular: { type: 'string' },
					unit_plural: { type: 'string' },
					meter_event_name: { type: 'string', nullable: true },
					aggregation: { type: 'string', enum: ['count', 'sum'], nullable: true },
					aggregation_field: { type: 'string', nullable: true },
				},
				required: ['name', 'key', 'type', 'unit_singular', 'unit_plural'],
			},
		},
		plans: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					description: { type: 'string' },
					prices: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								amount: { type: 'number' },
								currency: { type: 'string' },
								billing_period: { type: 'string', enum: ['monthly', 'annual', 'one_time'] },
							},
							required: ['amount', 'currency', 'billing_period'],
						},
					},
					entitlements: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								feature_key: { type: 'string' },
								is_unlimited: { type: 'boolean' },
								value: { type: 'number', nullable: true },
							},
							required: ['feature_key', 'is_unlimited', 'value'],
						},
					},
					usage_charges: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								feature_key: { type: 'string' },
								amount_per_unit: { type: 'number' },
								currency: { type: 'string' },
								billing_period: { type: 'string', enum: ['monthly', 'annual'] },
								billing_model: { type: 'string', enum: ['flat_fee', 'package'], nullable: true },
								package_size: { type: 'number', nullable: true },
								filter_values: {
									type: 'array',
									nullable: true,
									items: {
										type: 'object',
										properties: {
											key: { type: 'string' },
											values: { type: 'array', items: { type: 'string' } },
										},
										required: ['key', 'values'],
									},
								},
								display_name: { type: 'string', nullable: true },
							},
							required: ['feature_key', 'amount_per_unit', 'currency', 'billing_period'],
						},
					},
				},
				required: ['name', 'description', 'prices', 'entitlements'],
			},
		},
		credit_grants: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					plan_name: { type: 'string' },
					name: { type: 'string' },
					credits: { type: 'number' },
					cadence: { type: 'string', enum: ['onetime', 'recurring'] },
					period: { type: 'string', enum: ['monthly', 'annual'], nullable: true },
					conversion_rate: { type: 'number', nullable: true },
				},
				required: ['plan_name', 'name', 'credits', 'cadence'],
			},
		},
	},
	required: ['features', 'plans'],
};

// ============================================
// Smart template matching + contextual prompt builder
// ============================================

/**
 * Keyword signatures for each template. The key matches the template label (lowercase).
 * If the user's prompt scores ≥ MATCH_THRESHOLD hits we inject a reference context block.
 */
const TEMPLATE_KEYWORDS: Record<string, string[]> = {
	gemini: ['token', 'per million', 'openai', 'claude', 'model provider', 'llm api', 'input token', 'output token', 'anthropic'],
	apollo: ['credit', 'contact search', 'email unlock', 'phone reveal', 'sales intelligence', 'apollo', 'b2b', 'prospecting'],
	vapi: ['voice', 'call minute', 'speech', 'tts', 'stt', 'telephony', 'vapi', 'audio', 'voice ai', 'phone call'],
	railway: ['cpu', 'memory', 'egress', 'vcpu', 'compute', 'infra', 'gb-hour', 'gb hour', 'server', 'deployment', 'container'],
	cursor: ['agent request', 'tab completion', 'ide', 'code completion', 'coding assistant', 'cursor', 'copilot', 'autocomplete'],
};

const MATCH_THRESHOLD = 2;

/**
 * Score how closely a prompt matches each template by counting keyword hits.
 * Returns the best-matching template label or null if no template clears the threshold.
 */
function findMatchingTemplate(prompt: string): string | null {
	const lower = prompt.toLowerCase();
	let bestLabel: string | null = null;
	let bestScore = 0;

	for (const [label, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
		const score = keywords.reduce((n, kw) => n + (lower.includes(kw) ? 1 : 0), 0);
		if (score > bestScore) {
			bestScore = score;
			bestLabel = label;
		}
	}

	return bestScore >= MATCH_THRESHOLD ? bestLabel : null;
}

/**
 * Build an enriched prompt for the LLM.
 *
 * - If the prompt keyword-matches a template, append the template's full schema as a JSON
 *   reference block so the LLM understands the exact Flexprice patterns for that pricing style.
 * - Otherwise append a compact multi-pattern summary so the LLM still understands Flexprice conventions.
 */
export function buildContextualPrompt(userPrompt: string): string {
	const matchedLabel = findMatchingTemplate(userPrompt);

	if (matchedLabel) {
		const tpl = PRICING_TEMPLATES.find((t) => t.label.toLowerCase() === matchedLabel);
		if (tpl) {
			return `${userPrompt}

## Reference: Similar pricing pattern — use as structural guide, not a copy
${JSON.stringify(tpl.schema, null, 2)}`;
		}
	}

	// No specific template match — give a brief pattern summary so the LLM understands conventions
	return `${userPrompt}

## Plaqad BSP pattern examples (for structural reference only)
- Hybrid flat+overage (Cursor-style): flat monthly price + usage_charges with overage rates; entitlements only for included quantities (hard caps).
- Credit pool (Apollo-style): flat monthly price + credit_grants + usage_charges at credit costs per action; entitlements: [].
- Per-model token (Gemini-style): one feature per model×direction, package billing per 1M tokens; entitlements: [].
- Pure PAYG (Vapi-style): $0 platform price + usage_charges; entitlements only for static limits (e.g. concurrency), else [].
- Infra credit pool (Railway-style): flat monthly + credit_grants + usage_charges in credits/unit; entitlements: [].`;
}
