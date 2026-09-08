import { useEffect, useRef, useState } from 'react';
import { type AIAttachment, getAIFile, removeAIFile, uploadAIFile, validateAISelection } from '@/api/AiAttachmentsApi';
import { getErrorMessage } from '@/utils/errorMessage';

export type AttachmentItem = {
	key: string;
	name: string;
	size: number;
	state: 'uploading' | 'processing' | 'ready' | 'failed';
	server?: AIAttachment;
	error?: string;
};
export function useAIAttachments() {
	const [items, setItems] = useState<AttachmentItem[]>([]);
	const [error, setError] = useState('');
	const current = useRef(items);
	const life = useRef<AbortController | null>(null);
	const sync = (next: AttachmentItem[]) => {
		current.current = next;
		setItems(next);
	};
	useEffect(() => {
		const controller = new AbortController();
		life.current = controller;
		const polling = new Set<string>();
		const failures = new Map<string, number>();
		const timer = setInterval(() => {
			for (const item of current.current) {
				if (item.server && Date.parse(item.server.expires_at) <= Date.now() && item.state !== 'failed') {
					sync(
						current.current.map((x) =>
							x.key === item.key ? { ...x, state: 'failed', error: 'File expired. Remove it and attach it again.' } : x,
						),
					);
					continue;
				}
				if (!item.server || item.state !== 'processing' || polling.has(item.key)) continue;
				polling.add(item.key);
				void getAIFile(item.server.id, controller.signal)
					.then((server) => {
						failures.delete(item.key);
						if (!controller.signal.aborted)
							sync(current.current.map((x) => (x.key === item.key ? { ...x, server, state: server.status, error: server.error } : x)));
					})
					.catch((err) => {
						failures.set(item.key, (failures.get(item.key) ?? 0) + 1);
						if (!controller.signal.aborted && failures.get(item.key)! >= 3)
							sync(current.current.map((x) => (x.key === item.key ? { ...x, state: 'failed', error: getErrorMessage(err) } : x)));
					})
					.finally(() => polling.delete(item.key));
			}
		}, 5000);
		return () => {
			controller.abort();
			clearInterval(timer);
			for (const item of current.current) if (item.server) void removeAIFile(item.server.id).catch(() => {});
		};
	}, []);
	async function add(files: File[]) {
		setError('');
		try {
			validateAISelection(
				files,
				current.current.map((x) => x.size),
			);
		} catch (err) {
			setError(getErrorMessage(err));
			return;
		}
		const queued: AttachmentItem[] = files.map((file) => ({
			key: crypto.randomUUID(),
			name: file.name,
			size: file.size,
			state: 'uploading',
		}));
		sync([...current.current, ...queued]);
		const signal = life.current?.signal;
		if (!signal) return;
		for (let i = 0; i < files.length; i++) {
			const item = queued[i];
			if (signal.aborted || !current.current.some((x) => x.key === item.key)) continue;
			try {
				const server = await uploadAIFile(files[i], signal);
				if (signal.aborted || !current.current.some((x) => x.key === item.key)) {
					void removeAIFile(server.id).catch(() => {});
					continue;
				}
				sync(current.current.map((x) => (x.key === item.key ? { ...x, server, state: server.status, error: server.error } : x)));
			} catch (err) {
				if (!signal.aborted)
					sync(current.current.map((x) => (x.key === item.key ? { ...x, state: 'failed', error: getErrorMessage(err) } : x)));
			}
		}
	}
	function remove(key: string) {
		const item = current.current.find((x) => x.key === key);
		sync(current.current.filter((x) => x.key !== key));
		setError('');
		if (item?.server) void removeAIFile(item.server.id).catch(() => {});
	}
	function clear() {
		for (const item of [...current.current]) remove(item.key);
	}
	return {
		items,
		error,
		add,
		remove,
		clear,
		blocked: items.some((x) => x.state !== 'ready'),
		ids: items.flatMap((x) => (x.state === 'ready' && x.server ? [x.server.id] : [])),
	};
}
export type AIAttachmentsState = ReturnType<typeof useAIAttachments>;
