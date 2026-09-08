import axiosClient from '@/core/axios/config';

export interface AIAttachment {
	id: string;
	name: string;
	kind: 'text' | 'document' | 'image' | 'video';
	size: number;
	status: 'ready' | 'processing' | 'failed';
	error?: string;
	expires_at: string;
	sections?: number;
}
export const AI_FILE_ACCEPT = '.pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt,.md,.csv,.tsv,.json,.mp4,.mov,.webm';
export function validateAISelection(files: File[], existingSizes: number[]) {
	if (files.length + existingSizes.length > 4) throw new Error('Attach up to four files.');
	if (
		files.reduce(
			(sum, file) => sum + file.size,
			existingSizes.reduce((sum, size) => sum + size, 0),
		) >
		24 * 1024 * 1024
	)
		throw new Error('Attachments must total 24 MB or less.');
	for (const file of files) {
		if (!file.size || file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: choose a nonempty file up to 20 MB.`);
		if (!AI_FILE_ACCEPT.split(',').some((ext) => file.name.toLowerCase().endsWith(ext)))
			throw new Error(`${file.name}: unsupported format. Export older Office files to DOCX, XLSX or PPTX.`);
	}
}
export async function uploadAIFile(file: File, signal: AbortSignal): Promise<AIAttachment> {
	const body = new FormData();
	body.append('file', file);
	// Use the existing authenticated client directly: JSON sanitation would erase FormData.
	return (await axiosClient.post('/ai/attachments', body, {
		headers: { 'Content-Type': undefined },
		signal,
		timeout: 90000,
	})) as unknown as AIAttachment;
}
export async function getAIFile(id: string, signal: AbortSignal): Promise<AIAttachment> {
	return (await axiosClient.get(`/ai/attachments/${encodeURIComponent(id)}`, { signal, timeout: 60000 })) as unknown as AIAttachment;
}
export const removeAIFile = (id: string) => axiosClient.delete(`/ai/attachments/${encodeURIComponent(id)}`);
