import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/atoms';
import { billingGet, type UsageResponse } from '@/api/PlaqadBillingApi';
import { BillingPage, ErrorNotice, Field, Panel, date, fieldClass, number, tableClass } from './shared';
import { USAGE_PAGE_SIZE as LIMIT, usageDay as day, usageQuery, type UsageFilters as Filters } from './usage';
export default function UsagePage() {
	const [filters, setFilters] = useState<Filters>(() => {
		const before = new Date();
		before.setDate(before.getDate() - 29);
		return { from: day(before), to: day(new Date()), workspaceId: '', userId: '', product: '' };
	});
	const [applied, setApplied] = useState(filters);
	const [offset, setOffset] = useState(0);
	const [error, setError] = useState<unknown>(null);
	const usage = useQuery({
		queryKey: ['plaqad-usage', applied, offset],
		queryFn: () => billingGet<UsageResponse>(usageQuery(applied, offset)),
		refetchInterval: 60000,
	});
	const summary = usage.data?.summary;
	function apply(event: FormEvent) {
		event.preventDefault();
		try {
			usageQuery(filters, 0);
			setApplied({ ...filters });
			setOffset(0);
			setError(null);
		} catch (cause) {
			setError(cause);
		}
	}
	return (
		<BillingPage
			title='User usage'
			description='Review credit consumption and included plan activity across Plaqad workspaces, people and products.'>
			<Panel title='Usage period and filters'>
				<form onSubmit={apply}>
					<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
						<Field label='From'>
							<input
								className={fieldClass}
								type='date'
								required
								value={filters.from}
								onChange={(e) => setFilters({ ...filters, from: e.target.value })}
							/>
						</Field>
						<Field label='To'>
							<input
								className={fieldClass}
								type='date'
								required
								value={filters.to}
								min={filters.from}
								onChange={(e) => setFilters({ ...filters, to: e.target.value })}
							/>
						</Field>
						<Field label='Product'>
							<select className={fieldClass} value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })}>
								<option value=''>All products</option>
								{[
									['iq', 'IQ'],
									['os', 'OS'],
									['pa', 'PA'],
									['studio', 'Studio'],
									['maestro', 'Studio Plus'],
									['talent', 'Talent'],
									['intel', 'Intel'],
								].map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</Field>
						<Field label='Workspace ID'>
							<input
								className={fieldClass}
								value={filters.workspaceId}
								maxLength={160}
								onChange={(e) => setFilters({ ...filters, workspaceId: e.target.value })}
								placeholder='All workspaces'
							/>
						</Field>
						<Field label='User ID'>
							<input
								className={fieldClass}
								value={filters.userId}
								maxLength={160}
								onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
								placeholder='All people'
							/>
						</Field>
					</div>
					<div className='mt-5 flex flex-wrap items-center gap-3'>
						<Button variant='black' type='submit'>
							Apply filters
						</Button>
						<Button variant='outline' type='button' disabled={usage.isFetching} onClick={() => void usage.refetch()}>
							Refresh
						</Button>
						<span className='text-xs text-zinc-500'>
							{usage.isFetching
								? 'Updating…'
								: usage.dataUpdatedAt
									? `Updated ${new Date(usage.dataUpdatedAt).toLocaleTimeString()} · refreshes each minute`
									: ''}
						</span>
					</div>
				</form>
			</Panel>
			<ErrorNotice error={error || usage.error} retry={() => void usage.refetch()} />
			{usage.isLoading ? (
				<p role='status'>Loading usage…</p>
			) : (
				summary && (
					<>
						<div className='mb-6 grid grid-cols-2 divide-x divide-zinc-200 rounded-lg border border-zinc-200 bg-white lg:grid-cols-4'>
							{[
								['Net usage credits', summary.netCredits],
								['Credits refunded', summary.creditsRefunded],
								['People with activity', summary.users],
								['Plan operations', summary.planIncludedOperations + summary.planAllowanceOperations],
							].map(([label, value]) => (
								<div key={label} className='p-5'>
									<p className='mb-2 text-xs text-zinc-500'>{label}</p>
									<p className='text-2xl font-medium tabular-nums'>{number(Number(value))}</p>
								</div>
							))}
						</div>
						<p className='mb-5 text-sm text-zinc-600'>
							{number(summary.workspaces)} workspaces · {number(summary.usageEvents)} usage events · {number(summary.creditsDebited)}{' '}
							credits debited. Credit consumption is separate from payments collected.
						</p>
						<Panel title='Plan-funded activity'>
							<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
								{[
									['Included operations', summary.planIncludedOperations],
									['Allowance operations', summary.planAllowanceOperations],
									['Recorded plan units', summary.planUnits],
									['Recorded equivalent credits', summary.planUsageCreditsEquivalent],
								].map(([label, value]) => (
									<div key={label}>
										<p className='text-xs text-zinc-500'>{label}</p>
										<p className='mt-2 text-xl font-medium tabular-nums'>{number(Number(value))}</p>
									</div>
								))}
							</div>
							<p className='mt-4 text-xs text-zinc-500'>
								Equivalent credits describe recorded plan usage. They were covered by the plan and were not deducted from the credit
								balance.
							</p>
						</Panel>
						{usage.data?.coverage && (
							<p className='mb-5 rounded-md bg-zinc-50 p-4 text-sm leading-6 text-zinc-600'>
								{usage.data.coverage.message}
								{!usage.data.coverage.costAvailable && ' Provider cost and profit are not available for this report.'}
								{usage.data.coverage.historicalPlanOperationsWithoutActuals > 0 &&
									` ${number(usage.data.coverage.historicalPlanOperationsWithoutActuals)} older plan operations have no recorded actual usage and are excluded from the unit and equivalent-credit totals.`}
							</p>
						)}
						<Panel title='Activity by person, workspace and product'>
							<div className='overflow-x-auto'>
								<table className={tableClass}>
									<thead>
										<tr>
											<th>Person</th>
											<th>Workspace</th>
											<th>Product</th>
											<th>Debited</th>
											<th>Refunded</th>
											<th>Net credits</th>
											<th>Plan activity</th>
											<th>Last activity</th>
										</tr>
									</thead>
									<tbody>
										{usage.data?.items.map((row, index) => (
											<tr key={`${row.workspaceId}:${row.userId}:${row.serviceId}:${row.product}:${row.actorType}:${index}`}>
												<td>
													<span className='block font-medium'>
														{row.actorType === 'system'
															? 'Background activity'
															: row.actorType === 'unattributed'
																? 'Unattributed activity'
																: row.userName || row.userEmail || row.userId || 'Unknown person'}
													</span>
													<span className='block max-w-xs break-all text-xs text-zinc-500'>{row.userEmail || row.userId}</span>
												</td>
												<td>
													<span className='block'>{row.workspaceName || '—'}</span>
													<span className='text-xs text-zinc-500'>{row.workspaceId}</span>
												</td>
												<td>{row.product || '—'}</td>
												<td className='tabular-nums'>{number(row.creditsDebited)}</td>
												<td className='tabular-nums'>{number(row.creditsRefunded)}</td>
												<td className='font-medium tabular-nums'>{number(row.netCredits)}</td>
												<td className='whitespace-nowrap tabular-nums'>
													<p>
														{number(row.planIncludedOperations)} included · {number(row.planAllowanceOperations)} allowance
													</p>
													<p className='mt-1 text-xs text-zinc-500'>
														{number(row.planUnits)} recorded units · {number(row.planUsageCreditsEquivalent)} equivalent credits
													</p>
												</td>
												<td className='whitespace-nowrap text-xs'>{date(row.lastUsedAt)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							{usage.data?.items.length === 0 && (
								<p className='py-12 text-center text-sm text-zinc-500'>
									No activity matches this period and these filters. Try a wider date range.
								</p>
							)}
							<div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4'>
								<p className='text-xs text-zinc-500'>
									{number(usage.data?.pagination.total ?? 0)} rows · {offset + (usage.data?.items.length ? 1 : 0)}–
									{offset + (usage.data?.items.length ?? 0)}
								</p>
								<div className='flex gap-2'>
									<Button
										variant='outline'
										disabled={offset === 0 || usage.isFetching}
										onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
										Previous
									</Button>
									<Button
										variant='outline'
										disabled={offset + LIMIT >= (usage.data?.pagination.total ?? 0) || usage.isFetching}
										onClick={() => setOffset(offset + LIMIT)}>
										Next
									</Button>
								</div>
							</div>
						</Panel>
					</>
				)
			)}
		</BillingPage>
	);
}
