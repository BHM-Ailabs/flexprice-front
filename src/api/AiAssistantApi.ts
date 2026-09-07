import { AxiosClient } from '@/core/axios/verbs';
export interface AssistantMessage {
	role: 'user' | 'assistant';
	content: string;
}
export interface AssistantSource {
	label: string;
	path: string;
	retrieved_at: string;
}
export interface AssistantAnswer {
	answer: string;
	sources: AssistantSource[];
	environment_id: string;
}
export const askAssistant = (messages: AssistantMessage[], signal?: AbortSignal) =>
	AxiosClient.post<AssistantAnswer>('/ai/assistant', { messages }, { signal });
