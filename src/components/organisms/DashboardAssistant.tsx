import AIAttachments from '@/components/organisms/AIAttachments';
import { useAIAttachments } from '@/hooks/useAIAttachments';
import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowUp, BookOpen, Loader2, MessageSquare, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { askAssistant, type AssistantMessage, type AssistantSource } from '@/api/AiAssistantApi';
import { useEnvironment } from '@/hooks/useEnvironment';
import useUser from '@/hooks/useUser';
import EnvironmentApi from '@/api/EnvironmentApi';
import { getErrorMessage } from '@/utils/errorMessage';

type Turn = AssistantMessage & { sources?: AssistantSource[] };
const starters = ['Compare our Intel plans', 'Show revenue and collections this month', 'Help me quote a plan for a customer'];

export default function DashboardAssistant() {
	const { activeEnvironment } = useEnvironment();
	const { user } = useUser();
	const scope = `${user?.id ?? ''}:${user?.tenant?.id ?? ''}:${activeEnvironment?.id ?? ''}`;
	// A remount clears both in-flight responses and history on any identity/environment change.
	return (
		<AssistantPanel
			key={scope}
			environment={activeEnvironment?.name ?? 'Current environment'}
			environmentId={activeEnvironment?.id ?? ''}
		/>
	);
}
export function AssistantPanel({ environment, environmentId }: { environment: string; environmentId: string }) {
	const [open, setOpen] = useState(false);
	const files = useAIAttachments();
	const [draft, setDraft] = useState('');
	const [turns, setTurns] = useState<Turn[]>([]);
	const [error, setError] = useState('');
	const abortRef = useRef<AbortController | null>(null);
	const bottom = useRef<HTMLDivElement>(null);
	useEffect(() => () => abortRef.current?.abort(), []);
	useEffect(() => {
		bottom.current?.scrollIntoView({ block: 'end' });
	}, [turns, open]);
	const mutation = useMutation({
		mutationFn: async (messages: AssistantMessage[]) => {
			abortRef.current = new AbortController();
			const result = await askAssistant(messages, abortRef.current.signal, files.ids);
			if (result.environment_id !== environmentId || EnvironmentApi.getActiveEnvironmentId() !== environmentId)
				throw new Error('Environment changed. Ask your question again.');
			return result;
		},
	});
	async function send(text: string) {
		if ((!text.trim() && !files.ids.length) || files.blocked || mutation.isPending || !environmentId) return;
		text = text.trim() || 'Analyze the attached files and summarize the key findings.';
		setError('');
		const messages: Turn[] = [...turns, { role: 'user', content: text.trim() }];
		setTurns(messages);
		setDraft('');
		try {
			const result = await mutation.mutateAsync(messages.slice(-19).map(({ role, content }) => ({ role, content })));
			if (!abortRef.current?.signal.aborted)
				setTurns([...messages, { role: 'assistant', content: result.answer, sources: result.sources }]);
		} catch (err) {
			if (!abortRef.current?.signal.aborted) {
				setError(getErrorMessage(err) || 'Could not answer. Please retry.');
				setDraft(text);
				setTurns(turns);
			}
		}
	}
	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<button
					type='button'
					className='fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-md hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
					aria-label='Ask FlexPrice'>
					<MessageSquare size={17} />
					Ask FlexPrice
				</button>
			</SheetTrigger>
			<SheetContent className='flex w-[calc(100vw-2.5rem)] flex-col sm:w-full sm:max-w-lg' aria-describedby='assistant-description'>
				<SheetHeader className='pr-8'>
					<SheetTitle>Ask FlexPrice</SheetTitle>
					<SheetDescription id='assistant-description'>Plans, revenue, and billing records in {environment}.</SheetDescription>
				</SheetHeader>
				<div className='flex items-center justify-between border-b pb-3 text-xs text-gray-500'>
					<span>Answers from your live records</span>
					<button
						type='button'
						disabled={mutation.isPending}
						onClick={() => {
							setTurns([]);
							files.clear();
							setError('');
							setDraft('');
						}}
						className='inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-50'>
						<Plus size={14} />
						New chat
					</button>
				</div>
				<div className='min-h-0 flex-1 space-y-6 overflow-y-auto py-2' role='log' aria-live='polite' aria-label='Conversation'>
					{!turns.length && (
						<div className='space-y-5 pt-8'>
							<BookOpen className='text-gray-400' size={25} />
							<h3 className='text-xl font-medium tracking-tight'>What would you like to know?</h3>
							<p className='text-sm leading-6 text-gray-500'>
								Compare plans, check collections, or work through a quote. Open the sources to inspect the records behind an answer.
							</p>
							<div className='space-y-2'>
								{starters.map((text) => (
									<button
										key={text}
										type='button'
										onClick={() => void send(text)}
										disabled={!environmentId || files.blocked}
										className='block w-full rounded-lg border p-3 text-left text-sm hover:bg-gray-50 disabled:opacity-50'>
										{text}
									</button>
								))}
							</div>
						</div>
					)}
					{turns.map((turn, index) => (
						<article key={index} className={turn.role === 'user' ? 'ml-8 rounded-xl bg-gray-100 p-3' : 'space-y-3'}>
							<p className='mb-1 text-xs font-medium text-gray-500'>{turn.role === 'user' ? 'You' : 'FlexPrice'}</p>
							<div className='whitespace-pre-wrap break-words text-sm leading-6'>{turn.content}</div>
							{!!turn.sources?.length && (
								<div className='space-y-1 border-l-2 pl-3'>
									<p className='text-xs text-gray-500'>Sources</p>
									{turn.sources.map((source, i) =>
										source.attachment_id ? (
											<span key={i} className='block text-xs text-gray-600' title={`Retrieved ${source.retrieved_at}`}>
												{source.label}
											</span>
										) : (
											source.path.startsWith('/') &&
											!source.path.startsWith('//') && (
												<Link
													key={i}
													to={source.path}
													onClick={() => setOpen(false)}
													className='block text-xs underline underline-offset-2'
													title={`Retrieved ${source.retrieved_at}`}>
													{source.label}
												</Link>
											)
										),
									)}
								</div>
							)}
						</article>
					))}
					{mutation.isPending && (
						<p role='status' className='flex items-center gap-2 text-sm text-gray-500'>
							<Loader2 className='animate-spin motion-reduce:animate-none' size={16} />
							Checking your records…
						</p>
					)}
					<div ref={bottom} />
				</div>
				{error && (
					<p role='alert' className='text-sm text-red-700'>
						{error}
					</p>
				)}
				<form
					className='space-y-2 border-t pt-3'
					onSubmit={(event) => {
						event.preventDefault();
						void send(draft);
					}}>
					<AIAttachments files={files} disabled={mutation.isPending || !environmentId} />
					<div className='flex items-end gap-2 rounded-lg border p-2'>
						<textarea
							aria-label='Question for FlexPrice'
							rows={2}
							maxLength={8000}
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
									event.preventDefault();
									void send(draft);
								}
							}}
							placeholder='Ask about a plan, customer, or revenue…'
							className='min-w-0 flex-1 resize-none bg-transparent p-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-gray-400'
						/>
						<button
							type='submit'
							disabled={mutation.isPending || files.blocked || (!draft.trim() && !files.ids.length) || !environmentId}
							aria-label='Send question'
							className='rounded-md bg-gray-900 p-2 text-white disabled:opacity-40'>
							<ArrowUp size={18} />
						</button>
					</div>
					<p className='text-xs leading-5 text-gray-500'>Quotes are estimates. This assistant cannot change billing records.</p>
				</form>
			</SheetContent>
		</Sheet>
	);
}
