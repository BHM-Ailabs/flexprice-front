import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import RevenueDashboardApi from '@/api/RevenueDashboardApi';
import { useEnvironment } from '@/hooks/useEnvironment';
import { formatRevenueCurrency } from '@/lib/revenueDashboard';
import { RouteNames } from '@/core/routes/Routes';

export default function InvoiceCollections() {
	const { activeEnvironment } = useEnvironment();
	const now = new Date();
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
	const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
	const query = useQuery({
		queryKey: ['revenue-dashboard-home', activeEnvironment?.id, start, end],
		enabled: Boolean(activeEnvironment?.id),
		queryFn: () => RevenueDashboardApi.getRevenueDashboard({ period_start: start, period_end: end, window_size: 'DAY', customer_ids: [] }),
	});
	return (
		<section className='rounded-md border bg-white p-5' aria-labelledby='home-collections-title'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<h2 id='home-collections-title' className='font-semibold'>
					Invoice collections · this month
				</h2>
				<Link to={RouteNames.revenue} className='text-sm underline'>
					View revenue and invoices
				</Link>
			</div>
			<p className='mt-1 text-sm text-zinc-500'>
				Current paid balances for this month’s invoices, including prepaid credits. Grouped by service-period start or issue date; this is
				not earned revenue or cash flow by payment date.
			</p>
			{query.isPending ? (
				<p className='mt-4 text-sm'>Loading collections…</p>
			) : query.isError ? (
				<p role='alert' className='mt-4 text-sm'>
					Collections could not be loaded.{' '}
					<button className='underline' onClick={() => void query.refetch()}>
						Retry
					</button>
				</p>
			) : Object.keys(query.data?.collections ?? {}).length === 0 ? (
				<p className='mt-4 text-sm text-zinc-500'>No finalized invoices in this period.</p>
			) : (
				<div className='mt-4 grid gap-4 sm:grid-cols-2'>
					{Object.entries(query.data?.collections ?? {}).map(([currency, totals]) => (
						<div key={currency} className='rounded border p-4'>
							<p className='text-xs uppercase text-zinc-500'>
								{currency} · {totals.invoice_count} invoices
							</p>
							<p className='mt-1 text-xl font-semibold'>{formatRevenueCurrency(Number(totals.total_paid), currency)} collected</p>
							<p className='mt-1 text-sm text-zinc-500'>
								{formatRevenueCurrency(Number(totals.total_invoiced), currency)} invoiced ·{' '}
								{formatRevenueCurrency(Number(totals.total_unpaid), currency)} outstanding
							</p>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
