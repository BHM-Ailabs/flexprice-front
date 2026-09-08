import { AxiosClient } from '@/core/axios/verbs';
export interface AssistantMessage {
	role: 'user' | 'assistant';
	content: string;
}
export interface AssistantSource {
	attachment_id?: string;
	label: string;
	path: string;
	retrieved_at: string;
}
export interface AssistantAnswer {
	answer: string;
	sources: AssistantSource[];
	environment_id: string;
}
export const askAssistant = (messages: AssistantMessage[], signal?: AbortSignal, attachment_ids: string[] = []) =>
	AxiosClient.post<AssistantAnswer>('/ai/assistant', { messages, attachment_ids }, { signal });
