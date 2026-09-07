import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FEATURE_TYPE } from '@/models/Feature';
import { PRICING_TEMPLATES } from '@/api/ai/templates';
import type { PricingSchema } from '@/api/ai/types';
import { getSetupProgressSteps } from '@/api/ai/setupProgress';
import { orchestrateSetup } from '@/api/ai/orchestrator';
import FeatureApi from '@/api/FeatureApi';
import { PlanApi } from '@/api/PlanApi';
import { PriceApi } from '@/api/PriceApi';
import EntitlementApi from '@/api/EntitlementApi';
import CreditGrantApi from '@/api/CreditGrantApi';

vi.mock('@/api/FeatureApi', () => ({
	default: {
		listFeatures: vi.fn(),
		createFeature: vi.fn(),
	},
}));

vi.mock('@/api/PlanApi', () => ({
	PlanApi: {
		getPlansByFilter: vi.fn(),
		createPlan: vi.fn(),
	},
}));

vi.mock('@/api/PriceApi', () => ({
	PriceApi: {
		CreatePrice: vi.fn(),
	},
}));

vi.mock('@/api/EntitlementApi', () => ({
	default: {
		search: vi.fn(),
		create: vi.fn(),
	},
}));

vi.mock('@/api/CreditGrantApi', () => ({
	default: {
		list: vi.fn(),
		create: vi.fn(),
	},
}));

/** Minimal schema resembling a custom LLM parse: 1 plan, no entitlements / credit grants. */
const minimalCustomLikeSchema: PricingSchema = {
	features: [
		{
			name: 'API Calls',
			key: 'api_calls',
			type: 'metered',
			unit_singular: 'call',
			unit_plural: 'calls',
			meter_event_name: 'api.call',
			aggregation: 'count',
			aggregation_field: null,
		},
	],
	plans: [
		{
			name: 'Pro',
			description: 'Pro tier',
			prices: [{ amount: 29, currency: 'USD', billing_period: 'monthly' }],
			entitlements: [],
			usage_charges: [
				{
					feature_key: 'api_calls',
					amount_per_unit: 0.01,
					currency: 'USD',
					billing_period: 'monthly',
					billing_model: 'flat_fee',
					package_size: null,
					filter_values: null,
					display_name: null,
				},
			],
		},
	],
};

function setupHappyPathMocks(): void {
	let planCounter = 0;
	vi.mocked(FeatureApi.listFeatures).mockResolvedValue({
		items: [],
		pagination: { offset: 0, limit: 0, total: 0 },
	} as Awaited<ReturnType<typeof FeatureApi.listFeatures>>);
	vi.mocked(FeatureApi.createFeature).mockImplementation(
		async (data) =>
			({
				id: `feat-${data.lookup_key}`,
				type: data.type,
				meter_id: data.type === FEATURE_TYPE.METERED ? `meter-${data.lookup_key}` : undefined,
				meter: data.type === FEATURE_TYPE.METERED ? { id: `meter-${data.lookup_key}` } : undefined,
			}) as Awaited<ReturnType<typeof FeatureApi.createFeature>>,
	);

	vi.mocked(PlanApi.getPlansByFilter).mockResolvedValue({
		items: [],
		pagination: { offset: 0, limit: 0, total: 0 },
	} as Awaited<ReturnType<typeof PlanApi.getPlansByFilter>>);
	vi.mocked(PlanApi.createPlan).mockImplementation(async (data) => {
		planCounter += 1;
		return {
			id: `plan-id-${planCounter}`,
			name: data.name,
			lookup_key: data.lookup_key,
		} as Awaited<ReturnType<typeof PlanApi.createPlan>>;
	});

	vi.mocked(PriceApi.CreatePrice).mockResolvedValue({ id: 'price-1' } as Awaited<ReturnType<typeof PriceApi.CreatePrice>>);

	vi.mocked(EntitlementApi.search).mockResolvedValue({
		items: [],
		pagination: { offset: 0, limit: 0, total: 0 },
	} as Awaited<ReturnType<typeof EntitlementApi.search>>);
	vi.mocked(EntitlementApi.create).mockResolvedValue({ id: 'ent-1' } as Awaited<ReturnType<typeof EntitlementApi.create>>);

	vi.mocked(CreditGrantApi.list).mockResolvedValue({ items: [] } as Awaited<ReturnType<typeof CreditGrantApi.list>>);
	vi.mocked(CreditGrantApi.create).mockResolvedValue({ id: 'cg-1' } as Awaited<ReturnType<typeof CreditGrantApi.create>>);
}

describe('orchestrateSetup', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setupHappyPathMocks();
		vi.spyOn(global, 'setTimeout').mockImplementation((fn: TimerHandler) => {
			if (typeof fn === 'function') (fn as () => void)();
			return 0 as unknown as ReturnType<typeof setTimeout>;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('emits progress steps that match getSetupProgressSteps + done for every pricing template', async () => {
		for (const tpl of PRICING_TEMPLATES) {
			const steps: string[] = [];
			await orchestrateSetup(tpl.schema, (s) => steps.push(s));
			const expected = [...getSetupProgressSteps(tpl.schema), 'done'];
			expect(steps, `template ${tpl.label}`).toEqual(expected);
		}
	});

	it('refuses existing plan keys before creating any billing objects', async () => {
		vi.mocked(PlanApi.getPlansByFilter).mockResolvedValue({ items: [{ id: 'live-plan', name: 'Pro' }] } as Awaited<
			ReturnType<typeof PlanApi.getPlansByFilter>
		>);
		await expect(orchestrateSetup(minimalCustomLikeSchema)).rejects.toThrow('already exists');
		expect(FeatureApi.createFeature).not.toHaveBeenCalled();
		expect(PlanApi.createPlan).not.toHaveBeenCalled();
		expect(PriceApi.CreatePrice).not.toHaveBeenCalled();
	});

	it('completes for a minimal custom-like schema (no entitlements / credit grants)', async () => {
		const steps: string[] = [];
		await orchestrateSetup(minimalCustomLikeSchema, (s) => steps.push(s));
		expect(steps).toEqual([...getSetupProgressSteps(minimalCustomLikeSchema), 'done']);
	});
});
