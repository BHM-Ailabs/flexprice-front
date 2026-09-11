import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/atoms';
import { billingGet, type WorkspaceCreditEntry, type WorkspaceCreditsResponse } from '@/api/PlaqadBillingApi';
import { getPlaqadUser } from '@/core/auth/PlaqadAuth';
import { BillingPage, ErrorNotice, Field, Panel, date, fieldClass, number, tableClass } from './shared';
import { creditPaymentAmount, workspaceCreditsQuery } from './workspaceCredits';

const precise = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value);
const effects: Record<WorkspaceCreditEntry['effect'], string> = {
	award: 'Credits awarded',
	usage_debit: 'Usage debit',
	consumption_refund: 'Usage refund',
	hold: 'Reservation hold',
	hold_release: 'Hold released',
	expiry: 'Credits expired',
	adjustment: 'Adjustment',
	plan_usage: 'Plan activity',
	other: 'Ledger entry',
};

function CreditEvidence({ entry }: { entry: WorkspaceCreditEntry }) {
	const evidence = entry.rateEvidence;
	return (
		<details className='min-w-64 max-w-xl'>
			<summary className='cursor-pointer rounded text-sm font-medium text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600'>
				View recorded evidence
			</summary>
			<div className='mt-3 space-y-3 text-xs leading-5 text-zinc-600'>
				<p>{evidence.message}</p>
				{evidence.events.map((event) => (
					<div key={event.eventId} className='rounded border border-zinc-200 p-3'>
						<p className='font-medium text-zinc-900'>{event.displayName || event.sku || 'Unattributed operation'}</p>
						<p className='break-all'>
							{event.sku || 'SKU not retained'} · {event.units === null ? 'Units not retained' : `${precise(event.units)} units`} ·{' '}
							{number(event.credits)} credits applied
						</p>
						{event.creditPrice !== null && event.unitScale !== null && (
							<p>
								Recorded rate: {precise(event.creditPrice)} credits per {precise(event.unitScale)} {event.unit || 'units'}.
							</p>
						)}
						<p>
							Catalog {event.catalogVersion ?? 'unavailable'} · {event.pricingMode || 'pricing mode unavailable'}
							{event.markupBps !== null ? ` · ${precise(event.markupBps / 100)}% cost markup` : ''}
						</p>
						{event.usdCostMicro !== null && (
							<p>
								Catalog cost: USD {precise(event.usdCostMicro / 1_000_000)} per {precise(event.unitScale ?? 1)} {event.unit || 'units'}.
								This is the recorded catalog cost, not measured provider spend.
							</p>
						)}
					</div>
				))}
				{evidence.payment && (
					<div className='rounded border border-zinc-200 p-3'>
						<p className='font-medium text-zinc-900'>Verified purchase</p>
						<p>
							Invoice {evidence.payment.publicReference || 'number pending'} · {number(evidence.payment.creditsAwarded)} credits awarded
						</p>
						<p>{creditPaymentAmount(evidence.payment.amountMinor, evidence.payment.currency)} paid</p>
						{evidence.payment.fxRateMicro !== null && (
							<p>
								Recorded FX rate: {evidence.payment.currency} {precise(evidence.payment.fxRateMicro / 1_000_000)} per USD
								{evidence.payment.fxSpreadBps !== null ? ` (includes ${precise(evidence.payment.fxSpreadBps / 100)}% spread)` : ''}
							</p>
						)}
						{evidence.payment.fxSource && (
							<p>
								FX source: {evidence.payment.fxSource} · {date(evidence.payment.fxAt)}
							</p>
						)}
						<p className='break-all'>Payment reference: {evidence.payment.reference}</p>
					</div>
				)}
				{evidence.truncated && <p>Only part of this entry’s event evidence is shown. Totals use the complete recorded ledger.</p>}
				<dl className='space-y-1 break-all'>
					{[
						['Entry', entry.ledgerId || entry.id],
						['Call', entry.callId],
						['Reservation', entry.reservationId],
						['Bucket', entry.bucket],
						['Reason', entry.reasonCode],
						['Actor', entry.actor.id],
					]
						.filter(([, value]) => value)
						.map(([label, value]) => (
							<div key={label}>
								<dt className='inline font-medium'>{label}: </dt>
								<dd className='inline'>{value}</dd>
							</div>
						))}
				</dl>
				{entry.mirror && (
					<p>
						Native usage mirror: {entry.mirror.sent} sent, {entry.mirror.pending} pending, {entry.mirror.sending} sending,{' '}
						{entry.mirror.dead} failed. Mirror status does not change the Auth credit balance.
					</p>
				)}
			</div>
		</details>
	);
}

function WorkspaceCreditReport({ workspaceId, customerId }: { workspaceId: string; customerId: string }) {
	const [cursors, setCursors] = useState<string[]>(['']);
	const cursor = cursors[cursors.length - 1];
	let path = '',
		inputError: unknown;
	try {
		path = workspaceCreditsQuery(workspaceId, customerId, cursor);
	} catch (error) {
		inputError = error;
	}
	const report = useQuery({
		queryKey: ['plaqad-workspace-credits', getPlaqadUser()?.sub, workspaceId, customerId, cursor],
		queryFn: async ({ signal }) => {
			const result = await billingGet<WorkspaceCreditsResponse>(path, signal);
			if (
				result.source !== 'plaqad_auth' ||
				result.workspace.id !== workspaceId ||
				(customerId && (result.customer?.id !== customerId || result.customer.externalId !== workspaceId))
			) {
				throw new Error('The workspace and customer mapping could not be verified. Reopen the link from the customer profile.');
			}
			return result;
		},
		enabled: !!path,
		retry: false,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: 'always',
		refetchInterval: 60_000,
	});
	const data = !inputError && !report.error ? report.data : undefined;
	return (
		<>
			<ErrorNotice error={inputError || report.error} retry={path ? () => void report.refetch() : undefined} />
			{report.isLoading && <p role='status'>Loading workspace credits…</p>}
			{data && (
				<>
					<div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
						<div>
							<h2 className='text-xl font-medium'>{data.workspace.name}</h2>
							<p className='mt-1 text-xs text-zinc-500'>
								{data.workspace.id} · {data.workspace.status} · Auth ledger as of {date(data.asOf)}
							</p>
						</div>
						<Button variant='outline' disabled={report.isFetching} onClick={() => void report.refetch()}>
							{report.isFetching ? 'Updating…' : 'Refresh'}
						</Button>
					</div>
					{data.balance.lockedReason && (
						<p role='status' className='mb-5 rounded border border-amber-200 bg-amber-50 p-4 text-sm'>
							Credit spending is locked: {data.balance.lockedReason}
						</p>
					)}
					<div className='mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
						{[
							['Available credits', data.balance.availableCredits],
							['Held for pending work', data.balance.heldCredits],
							['Lifetime awarded', data.totals.awardedCredits],
							['Lifetime used', data.totals.usedCredits],
						].map(([label, value]) => (
							<div key={label} className='rounded-lg border border-zinc-200 bg-white p-5'>
								<p className='text-xs text-zinc-500'>{label}</p>
								<p className='mt-2 text-2xl font-medium tabular-nums'>{number(Number(value))}</p>
							</div>
						))}
					</div>
					<Panel title='Credit balance and reconciliation'>
						<dl className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
							{[
								['Total including holds', data.balance.totalCredits],
								['Purchased credits', data.totals.purchasedCredits],
								['Opening credits', data.totals.openingCredits],
								['Usage refunds', data.totals.refundedCredits],
								['Expired credits', data.totals.expiredCredits],
								['Net adjustments', data.totals.adjustmentNet],
								['Signed ledger balance', data.totals.ledgerBalance],
								['Balance difference', data.totals.reconciliationDelta],
							].map(([label, value]) => (
								<div key={label}>
									<dt className='text-xs text-zinc-500'>{label}</dt>
									<dd className='mt-1 text-lg tabular-nums'>{number(Number(value))}</dd>
								</div>
							))}
						</dl>
						<p className='mt-4 text-xs leading-5 text-zinc-500'>
							Available credits already exclude pending holds. Hold releases are not usage refunds. Balance difference compares the stored
							available balance with the signed ledger; this read-only view does not adjust either.
						</p>
						{data.totals.reconciliationDelta !== 0 && (
							<p role='status' className='mt-3 text-sm text-amber-800'>
								The stored balance and ledger differ by {number(data.totals.reconciliationDelta)} credits. Review the recorded entries
								before making a correction.
							</p>
						)}
					</Panel>
					<Panel title='Plan-funded activity'>
						<p className='text-sm'>
							{number(data.planUsage.includedOperations)} included operations · {number(data.planUsage.allowanceOperations)} allowance
							operations · {number(data.planUsage.actualPlanUnits)} recorded units · {number(data.planUsage.actualCreditsEquivalent)}{' '}
							equivalent credits
						</p>
						<p className='mt-3 text-xs leading-5 text-zinc-500'>
							Plan activity does not deduct the credits shown above.{' '}
							{data.planUsage.operationsWithoutActuals > 0
								? `${number(data.planUsage.operationsWithoutActuals)} older operations have no recorded actual usage.`
								: ''}
						</p>
					</Panel>
					<p className='mb-5 text-sm leading-6 text-zinc-600'>{data.coverage.message}</p>
					<Panel title='Credit activity and applied rates'>
						<div className='overflow-x-auto'>
							<table className={tableClass}>
								<thead>
									<tr>
										<th>Date</th>
										<th>Activity</th>
										<th>Application</th>
										<th>Credit change</th>
										<th>Recorded evidence</th>
									</tr>
								</thead>
								<tbody>
									{data.items.map((entry) => (
										<tr key={entry.id}>
											<td className='whitespace-nowrap text-xs'>{date(entry.ts)}</td>
											<td>
												<p className='font-medium'>{effects[entry.effect]}</p>
												<p className='mt-1 text-xs text-zinc-500'>{entry.reasonCode || entry.type}</p>
												{entry.plan && (
													<p className='mt-1 text-xs text-zinc-500'>
														{entry.plan.operation} · {entry.plan.source} · {entry.plan.planLookupKey || 'plan'}
													</p>
												)}
											</td>
											<td>
												{entry.application || entry.serviceName || 'Unattributed'}
												<p className='mt-1 text-xs text-zinc-500'>
													{entry.actor.type === 'system' ? 'Background activity' : entry.actor.type || 'Unattributed actor'}
												</p>
											</td>
											<td className='whitespace-nowrap font-medium tabular-nums'>
												{entry.amount > 0 ? '+' : ''}
												{number(entry.amount)}
												{entry.effect === 'plan_usage' && <p className='text-xs font-normal text-zinc-500'>Covered by plan</p>}
											</td>
											<td>
												<CreditEvidence entry={entry} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{!data.items.length && (
							<p className='py-8 text-center text-sm text-zinc-500'>No recorded credit activity for this workspace.</p>
						)}
						<div className='mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4'>
							<p className='text-xs text-zinc-500'>
								Page {cursors.length} · {data.items.length} entries · newest first
							</p>
							<div className='flex gap-2'>
								<Button
									variant='outline'
									disabled={cursors.length === 1 || report.isFetching}
									onClick={() => setCursors(cursors.slice(0, -1))}>
									Previous
								</Button>
								<Button
									variant='outline'
									disabled={!data.pagination.hasMore || !data.pagination.nextBefore || report.isFetching}
									onClick={() => {
										if (data.pagination.nextBefore) setCursors([...cursors, data.pagination.nextBefore]);
									}}>
									Next
								</Button>
							</div>
						</div>
					</Panel>
				</>
			)}
		</>
	);
}

export default function WorkspaceCreditsPage() {
	const [params, setParams] = useSearchParams();
	const workspaceId = params.get('workspaceId') || '';
	const customerId = params.get('customerId') || '';
	const [input, setInput] = useState(workspaceId);
	const [error, setError] = useState<unknown>(null);
	useEffect(() => {
		setInput(workspaceId);
		setError(null);
	}, [workspaceId, customerId]);
	function apply(event: FormEvent) {
		event.preventDefault();
		try {
			const id = input.trim();
			workspaceCreditsQuery(id);
			setParams({ workspaceId: id });
			setError(null);
		} catch (cause) {
			setError(cause);
		}
	}
	return (
		<BillingPage
			title='Workspace credits'
			description='Inspect the authoritative Plaqad Account balance, credit activity and recorded pricing for a workspace.'>
			<Panel title='Workspace'>
				<form onSubmit={apply} className='flex flex-wrap items-end gap-3'>
					<div className='min-w-64 flex-1'>
						<Field label='Workspace ID'>
							<input
								className={fieldClass}
								value={input}
								onChange={(event) => setInput(event.target.value)}
								placeholder='ws_…'
								maxLength={160}
								required
							/>
						</Field>
					</div>
					<Button variant='black' type='submit'>
						View credits
					</Button>
				</form>
				{customerId && (
					<p className='mt-3 text-xs text-zinc-500'>
						Opened from{' '}
						<Link to={`/billing/customers/${encodeURIComponent(customerId)}`} className='underline'>
							customer {customerId}
						</Link>
						. The API verifies that its external ID matches this workspace.
					</p>
				)}
				<p className='mt-3 text-xs leading-5 text-zinc-500'>
					These are Plaqad application credits. Native billing wallets track separate invoice funding. No credits are issued or synchronized
					by opening this page.
				</p>
			</Panel>
			<ErrorNotice error={error} />
			{workspaceId ? (
				<WorkspaceCreditReport key={`${workspaceId}:${customerId}`} workspaceId={workspaceId} customerId={customerId} />
			) : (
				<p className='text-sm text-zinc-500'>Enter a workspace ID or open Workspace credits from a customer profile.</p>
			)}
		</BillingPage>
	);
}
