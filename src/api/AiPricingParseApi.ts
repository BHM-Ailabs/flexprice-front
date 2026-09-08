import { AxiosClient } from '@/core/axios/verbs';
import type { PricingSchema } from '@/api/ai/types';

export type GeminiResponseSchema = Record<string, unknown>;

export interface ParseGeminiPricingRequest {
	attachment_ids?: string[];
	systemPrompt: string;
	userPrompt: string;
	responseSchema: GeminiResponseSchema;
}

/**
 * Server-side OpenRouter pricing — same auth/interceptors as other Flexprice APIs
POST /ai/pricing/parse (base URL is VITE_API_URL, e.g. http://localhost:8080/v1)
 */
class AiPricingParseApi {
	private static readonly path = '/ai/pricing/parse';

	public static async parseGemini(body: ParseGeminiPricingRequest): Promise<PricingSchema> {
		return await AxiosClient.post<PricingSchema, ParseGeminiPricingRequest>(this.path, body);
	}
}

export default AiPricingParseApi;
