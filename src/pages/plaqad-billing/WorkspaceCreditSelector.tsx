import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingGet, type CreditWorkspacesResponse } from '@/api/PlaqadBillingApi';
import { getPlaqadUser } from '@/core/auth/PlaqadAuth';
import { ErrorNotice, Field, fieldClass } from './shared';

export default function WorkspaceCreditSelector({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
	const [search, setSearch] = useState('');
	const [debounced, setDebounced] = useState('');
	const [open, setOpen] = useState(false);
	const normalized = search.trim();
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(normalized), 250);
		return () => clearTimeout(timer);
	}, [normalized]);
	const results = useQuery({
		queryKey: ['plaqad-credit-workspaces', getPlaqadUser()?.sub, debounced],
		queryFn: async ({ signal }) => ({
			search: debounced,
			response: await billingGet<CreditWorkspacesResponse>(
				`/workspace-credits/workspaces?${new URLSearchParams({ search: debounced, limit: '20' })}`,
				signal,
			),
		}),
		enabled: open && normalized === debounced,
		retry: false,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: 'always',
	});
	const matching = open && normalized === debounced;
	const data = matching && !results.error && results.data?.search === normalized ? results.data.response : undefined;
	return (
		<div className='mb-5'>
			<Field label='Find workspace'>
				<input
					className={fieldClass}
					value={search}
					type='search'
					placeholder='Search workspaces…'
					maxLength={200}
					autoComplete='off'
					aria-describedby='credit-workspace-help'
					onFocus={() => setOpen(true)}
					onChange={(event) => {
						setSearch(event.target.value);
						setOpen(true);
					}}
					aria-controls={open ? 'credit-workspace-results' : undefined}
				/>
			</Field>
			<p id='credit-workspace-help' className='mt-2 text-xs leading-5 text-zinc-500'>
				Search by workspace name, slug, ID or owner email.
			</p>
			{open && (
				<div id='credit-workspace-results' className='mt-3 rounded-md border border-zinc-200 p-3'>
					<ErrorNotice error={matching ? results.error : undefined} retry={() => void results.refetch()} />
					{(!matching || results.isLoading) && (
						<p role='status' className='p-2 text-sm text-zinc-500'>
							Finding workspaces…
						</p>
					)}
					{data && (
						<>
							<ul aria-label='Matching workspaces' className='max-h-72 overflow-y-auto'>
								{data.workspaces.map((workspace) => (
									<li key={workspace.id}>
										<button
											type='button'
											className='flex w-full items-center justify-between gap-4 rounded px-3 py-3 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600'
											onClick={() => {
												onSelect(workspace.id);
												setOpen(false);
												setSearch('');
											}}>
											<span>
												<span className='block text-sm font-medium text-zinc-900'>{workspace.name}</span>
												<span className='block text-xs text-zinc-500'>
													{workspace.slug} · {workspace.status}
												</span>
											</span>
											<span className='text-xs text-zinc-500'>{workspace.id === selectedId ? 'Selected' : 'View credits'}</span>
										</button>
									</li>
								))}
							</ul>
							{!data.workspaces.length && (
								<p className='p-2 text-sm text-zinc-500'>No matching workspaces. Try another name, slug or owner email.</p>
							)}
							{data.hasMore && (
								<p className='px-3 py-2 text-xs text-zinc-500'>More workspaces match. Refine your search to find the workspace.</p>
							)}
						</>
					)}
					<button
						type='button'
						className='mt-2 rounded px-3 py-2 text-sm text-zinc-600 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600'
						onClick={() => setOpen(false)}>
						Close search
					</button>
				</div>
			)}
		</div>
	);
}
