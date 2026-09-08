import { useId, useRef } from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { AI_FILE_ACCEPT } from '@/api/AiAttachmentsApi';
import type { AIAttachmentsState } from '@/hooks/useAIAttachments';

export default function AIAttachments({ files, disabled = false }: { files: AIAttachmentsState; disabled?: boolean }) {
	const input = useRef<HTMLInputElement>(null);
	const help = useId();
	return (
		<div
			className='space-y-2'
			onDragOver={(event) => {
				event.preventDefault();
			}}
			onDrop={(event) => {
				event.preventDefault();
				if (!disabled) void files.add(Array.from(event.dataTransfer.files));
			}}>
			<input
				ref={input}
				type='file'
				multiple
				accept={AI_FILE_ACCEPT}
				className='sr-only'
				tabIndex={-1}
				aria-label='Choose attachments'
				disabled={disabled}
				onChange={(event) => {
					void files.add(Array.from(event.target.files ?? []));
					event.target.value = '';
				}}
			/>
			<button
				type='button'
				disabled={disabled || files.items.length >= 4}
				onClick={() => input.current?.click()}
				aria-describedby={help}
				className='inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-40'>
				<Paperclip size={15} />
				Attach files
			</button>
			<p id={help} className='text-xs leading-5 text-gray-500'>
				Drop PDF, Office, image, text, or video files here. Up to 4 files, 20 MB each / 24 MB total; videos up to 60 seconds. Files expire
				after 1 hour.
			</p>
			{!!files.items.length && (
				<ul className='max-h-40 space-y-2 overflow-y-auto' aria-label='Attachments'>
					{files.items.map((item) => (
						<li key={item.key} className='flex items-start gap-2 rounded-lg border bg-white px-3 py-2 text-xs'>
							{item.state === 'uploading' || item.state === 'processing' ? (
								<Loader2 size={15} className='mt-0.5 shrink-0 animate-spin motion-reduce:animate-none' />
							) : (
								<FileText size={15} className='mt-0.5 shrink-0 text-gray-500' />
							)}
							<div className='min-w-0 flex-1'>
								<p className='truncate font-medium' title={item.name}>
									{item.name}
								</p>
								<p role='status' className={item.state === 'failed' ? 'mt-1 text-red-700' : 'mt-1 text-gray-500'}>
									{item.state === 'ready'
										? 'Ready'
										: item.state === 'processing'
											? 'Reading document… You can keep writing.'
											: item.state === 'uploading'
												? 'Uploading…'
												: item.error || 'Could not read file. Remove it and try again.'}
								</p>
							</div>
							<button
								type='button'
								disabled={disabled}
								onClick={() => files.remove(item.key)}
								aria-label={`Remove ${item.name}`}
								className='rounded p-1 hover:bg-gray-100 disabled:opacity-40'>
								<X size={14} />
							</button>
						</li>
					))}
				</ul>
			)}
			{files.error && (
				<p role='alert' className='text-xs text-red-700'>
					{files.error}
				</p>
			)}
		</div>
	);
}
