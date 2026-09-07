import { z } from 'zod';

const amount = z.number().finite().nonnegative();
const currency = z.string().regex(/^[A-Za-z]{3}$/);
const period = z.enum(['monthly', 'annual']);
const optionalText = z.string().nullable().optional();
const feature = z
	.object({
		name: z.string().trim().min(1),
		key: z.string().trim().min(1),
		type: z.enum(['static', 'metered']),
		unit_singular: z.string(),
		unit_plural: z.string(),
		meter_event_name: optionalText,
		aggregation: z.enum(['count', 'sum']).nullable().optional(),
		aggregation_field: optionalText,
	})
	.refine((f) => f.aggregation !== 'sum' || !!f.aggregation_field?.trim(), 'SUM meters need an aggregation field');
const charge = z
	.object({
		feature_key: z.string().min(1),
		amount_per_unit: amount,
		currency,
		billing_period: period,
		billing_model: z.enum(['flat_fee', 'package']).nullable().optional(),
		package_size: z.number().positive().nullable().optional(),
		filter_values: z
			.array(z.object({ key: z.string(), values: z.array(z.string()) }))
			.nullable()
			.optional(),
		display_name: optionalText,
	})
	.refine((c) => c.billing_model !== 'package' || !!c.package_size, 'Package prices need a positive package size');
export const pricingSchema = z
	.object({
		features: z.array(feature).max(200),
		plans: z
			.array(
				z.object({
					name: z.string().trim().min(1),
					description: z.string(),
					prices: z.array(z.object({ amount, currency, billing_period: z.enum(['monthly', 'annual', 'one_time']) })),
					entitlements: z.array(z.object({ feature_key: z.string(), is_unlimited: z.boolean(), value: amount.nullable() })),
					usage_charges: z.array(charge).optional(),
				}),
			)
			.min(1)
			.max(20),
		credit_grants: z
			.array(
				z.object({
					plan_name: z.string(),
					name: z.string(),
					credits: amount,
					cadence: z.enum(['onetime', 'recurring']),
					period: period.nullable().optional(),
					conversion_rate: amount.nullable().optional(),
				}),
			)
			.optional(),
	})
	.superRefine((schema, ctx) => {
		const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
		const features = new Map(schema.features.map((f) => [f.key, f]));
		if (features.size !== schema.features.length) issue('Feature keys must be unique');
		const plans = new Set(schema.plans.map((p) => p.name));
		if (plans.size !== schema.plans.length) issue('Plan names must be unique');
		for (const plan of schema.plans) {
			if (!plan.prices.length && !plan.usage_charges?.length) issue('Each plan needs a price');
			for (const entitlement of plan.entitlements) {
				if (!features.has(entitlement.feature_key)) issue('Entitlement refers to an unknown feature');
				if (!entitlement.is_unlimited && entitlement.value === null) issue('Limited entitlements need a value');
			}
			for (const charge of plan.usage_charges ?? []) {
				if (features.get(charge.feature_key)?.type !== 'metered') issue('Usage prices must reference a metered feature');
			}
		}
		for (const grant of schema.credit_grants ?? []) {
			if (!plans.has(grant.plan_name)) issue('Credit grant refers to an unknown plan');
			if (grant.cadence === 'recurring' && !grant.period) issue('Recurring credits need a period');
		}
	});
export function validatePricingSchema(raw: unknown) {
	const parsed = pricingSchema.safeParse(raw);
	if (!parsed.success) throw new Error(`AI pricing needs correction: ${parsed.error.issues[0].message}. Please revise the description.`);
	return parsed.data;
}
