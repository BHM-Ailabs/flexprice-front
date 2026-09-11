import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { useNavigate } from 'react-router';
import {
	ArrowDownRight,
	ArrowUpRight,
	Building2,
	ChevronLeft,
	ChevronRight,
	ChevronRightIcon,
	Download,
	ExternalLink,
	FileText,
	Search,
	Users,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import { Page, Select } from '@/components/atoms';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/molecules';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import InvoiceApi from '@/api/InvoiceApi';
import PaymentApi from '@/api/PaymentApi';
import RevenueDashboardApi from '@/api/RevenueDashboardApi';
import { RouteNames } from '@/core/routes/Routes';
import { INVOICE_STATUS, type Invoice } from '@/models/Invoice';
import { SortDirection } from '@/types/common/QueryBuilder';
import type {
	RevenueAgingRow,
	RevenueCollectionSummary,
	RevenueDashboardGraph,
	RevenueLeaderboardItem,
	RevenueLeaderboards,
} from '@/types/dto/RevenueDashboard';
import { formatRevenueCurrency } from '@/lib/revenueDashboard';
import { cn } from '@/lib/utils';
import { useEnvironment } from '@/hooks/useEnvironment';

type RevenueFilterValue = 'this_month' | 'this_quarter' | 'this_year' | 'last_month' | 'last_quarter' | 'last_year';

const FILTER_OPTIONS = [
	{ value: 'this_month', label: 'This month' },
	{ value: 'this_quarter', label: 'This quarter' },
	{ value: 'this_year', label: 'This year' },
	{ value: 'last_month', label: 'Last month' },
	{ value: 'last_quarter', label: 'Last quarter' },
	{ value: 'last_year', label: 'Last year' },
] satisfies { value: RevenueFilterValue; label: string }[];

const INVOICE_PAGE_SIZE = 15;
const EMPTY_COLLECTION: RevenueCollectionSummary = {
	total_invoiced: 0,
	total_paid: 0,
	total_unpaid: 0,
	total_workspaces: 0,
	invoice_count: 0,
	paid_invoice_count: 0,
	overdue_invoice_count: 0,
};
const EMPTY_GRAPH: RevenueDashboardGraph = { total_revenue: [], invoiced: [], paid: [] };
const EMPTY_LEADERBOARDS: RevenueLeaderboards = { apps: [], users: [], plans: [], workspaces: [] };

const getDateRangeForPeriod = (period: RevenueFilterValue) => {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = now.getUTCMonth();
	const utcMonth = (targetYear: number, targetMonth: number) => new Date(Date.UTC(targetYear, targetMonth, 1));

	switch (period) {
		case 'this_month':
			return { start: utcMonth(year, month), end: utcMonth(year, month + 1), shiftMonths: 1 };
		case 'last_month':
			return { start: utcMonth(year, month - 1), end: utcMonth(year, month), shiftMonths: 1 };
		case 'this_quarter': {
			const quarterStart = Math.floor(month / 3) * 3;
			return { start: utcMonth(year, quarterStart), end: utcMonth(year, quarterStart + 3), shiftMonths: 3 };
		}
		case 'last_quarter': {
			const quarterStart = Math.floor(month / 3) * 3;
			return { start: utcMonth(year, quarterStart - 3), end: utcMonth(year, quarterStart), shiftMonths: 3 };
		}
		case 'this_year':
			return { start: utcMonth(year, 0), end: utcMonth(year + 1, 0), shiftMonths: 12 };
		case 'last_year':
			return { start: utcMonth(year - 1, 0), end: utcMonth(year, 0), shiftMonths: 12 };
	}
};

const getComparablePreviousRange = (start: Date, end: Date, shiftMonths: number) => {
	const previousStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - shiftMonths, 1));
	const previousPeriodEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - shiftMonths, 1));
	const now = new Date();
	const currentElapsed = Math.max(0, Math.min(now.getTime(), end.getTime()) - start.getTime());
	const previousEnd =
		end.getTime() > now.getTime()
			? new Date(Math.min(previousStart.getTime() + currentElapsed, previousPeriodEnd.getTime()))
			: previousPeriodEnd;
	return { start: previousStart, end: previousEnd };
};

const toNumber = (value: unknown): number => {
	const numeric = typeof value === 'number' ? value : Number(value ?? 0);
	return Number.isFinite(numeric) ? numeric : 0;
};

const formatDate = (value: string | undefined): string => {
	if (!value) return '—';
	return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatGraphLabel = (label: string): string => {
	const date = new Date(`${label}${label.length === 7 ? '-01' : ''}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return label;
	return date.toLocaleDateString(undefined, label.length === 7 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' });
};

const formatCompactCurrency = (value: number, currency: string): string => {
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: currency.toUpperCase(),
			notation: 'compact',
			maximumFractionDigits: 1,
		}).format(value);
	} catch {
		return `${currency.toUpperCase()} ${value.toLocaleString()}`;
	}
};

const getPaymentLabel = (invoice: Invoice, now: Date): 'Paid' | 'Overdue' | 'Pending' | 'Processing' | 'Failed' => {
	if (toNumber(invoice.amount_remaining) <= 0 && toNumber(invoice.amount_due) > 0) return 'Paid';
	if (invoice.due_date && new Date(invoice.due_date) < now) return 'Overdue';
	const status = String(invoice.payment_status || '').toUpperCase();
	if (status === 'PROCESSING' || status === 'INITIATED') return 'Processing';
	if (status === 'FAILED') return 'Failed';
	return 'Pending';
};

const mergeGraphSeries = (graph: RevenueDashboardGraph) => {
	const rows = new Map<string, { label: string; recognized: number; invoiced: number; paid: number }>();
	const add = (key: 'recognized' | 'invoiced' | 'paid', points: { label: string; value: string }[] = []) => {
		points.forEach((point) => {
			const row = rows.get(point.label) ?? { label: point.label, recognized: 0, invoiced: 0, paid: 0 };
			row[key] = toNumber(point.value);
			rows.set(point.label, row);
		});
	};
	add('recognized', graph.total_revenue);
	add('invoiced', graph.invoiced);
	add('paid', graph.paid);
	return [...rows.values()].sort((left, right) => left.label.localeCompare(right.label));
};

const calculateDelta = (current: number, previous: number) => {
	if (previous === 0) return current === 0 ? null : { label: 'New', positive: true };
	const value = ((current - previous) / Math.abs(previous)) * 100;
	return { label: `${Math.abs(value).toFixed(1)}%`, positive: value >= 0 };
};

const Revenue = () => {
	const navigate = useNavigate();
	const { activeEnvironment } = useEnvironment();
	const environmentId = activeEnvironment?.id;
	const [selectedFilter, setSelectedFilter] = useState<RevenueFilterValue>('this_quarter');
	const [selectedCurrency, setSelectedCurrency] = useState('');
	const [invoicePage, setInvoicePage] = useState(1);
	const [invoiceSearch, setInvoiceSearch] = useState('');
	const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
	const [debouncedInvoiceSearch] = useDebounce(invoiceSearch.trim(), 300);
	const { start, end, shiftMonths } = useMemo(() => getDateRangeForPeriod(selectedFilter), [selectedFilter]);
	const previousRange = useMemo(() => getComparablePreviousRange(start, end, shiftMonths), [end, shiftMonths, start]);
	const startIso = start.toISOString();
	const endIso = end.toISOString();
	const windowSize = selectedFilter.endsWith('year') ? 'MONTH' : 'DAY';

	const revenueQuery = useQuery({
		queryKey: ['revenue-dashboard', environmentId, selectedFilter, startIso, endIso, windowSize],
		queryFn: () =>
			RevenueDashboardApi.getRevenueDashboard({
				period_start: startIso,
				period_end: endIso,
				customer_ids: [],
				window_size: windowSize,
			}),
	});

	const previousRevenueQuery = useQuery({
		queryKey: [
			'revenue-dashboard-comparison',
			environmentId,
			selectedFilter,
			previousRange.start.toISOString(),
			previousRange.end.toISOString(),
			windowSize,
		],
		queryFn: () =>
			RevenueDashboardApi.getRevenueDashboard({
				period_start: previousRange.start.toISOString(),
				period_end: previousRange.end.toISOString(),
				customer_ids: [],
				window_size: windowSize,
			}),
	});

	const currencies = useMemo(() => {
		const data = revenueQuery.data;
		const values = new Set([
			...Object.keys(data?.summaries ?? {}),
			...Object.keys(data?.collections ?? {}),
			...Object.keys(data?.graphs ?? {}),
			...Object.keys(data?.aging ?? {}),
			...Object.keys(data?.leaderboards ?? {}),
		]);
		return [...values].sort((left, right) => {
			const rightValue = toNumber(data?.collections?.[right]?.total_invoiced);
			const leftValue = toNumber(data?.collections?.[left]?.total_invoiced);
			return rightValue - leftValue || left.localeCompare(right);
		});
	}, [revenueQuery.data]);

	useEffect(() => {
		if (currencies.length > 0 && !currencies.includes(selectedCurrency)) setSelectedCurrency(currencies[0]);
	}, [currencies, selectedCurrency]);

	useEffect(() => setInvoicePage(1), [debouncedInvoiceSearch, selectedCurrency]);

	const invoiceQuery = useQuery({
		queryKey: ['revenue-invoices', environmentId, selectedFilter, selectedCurrency, debouncedInvoiceSearch, invoicePage, startIso, endIso],
		enabled: Boolean(selectedCurrency),
		queryFn: () =>
			InvoiceApi.listInvoices({
				search: debouncedInvoiceSearch || undefined,
				limit: INVOICE_PAGE_SIZE,
				offset: (invoicePage - 1) * INVOICE_PAGE_SIZE,
				currency: selectedCurrency,
				invoice_status: [INVOICE_STATUS.FINALIZED],
				reporting_date_gte: startIso,
				reporting_date_lt: endIso,
				skip_line_items: true,
				sort: [{ field: 'created_at', direction: SortDirection.DESC }],
			}),
	});

	const collection = revenueQuery.data?.collections?.[selectedCurrency] ?? EMPTY_COLLECTION;
	const previousCollection = previousRevenueQuery.data?.collections?.[selectedCurrency] ?? EMPTY_COLLECTION;
	const graph = revenueQuery.data?.graphs?.[selectedCurrency] ?? EMPTY_GRAPH;
	const graphData = useMemo(() => mergeGraphSeries(graph), [graph]);
	const aging = revenueQuery.data?.aging?.[selectedCurrency] ?? [];
	const leaderboards = revenueQuery.data?.leaderboards?.[selectedCurrency] ?? EMPTY_LEADERBOARDS;
	const invoiceTotal = invoiceQuery.data?.pagination.total ?? 0;
	const invoicePages = Math.max(1, Math.ceil(invoiceTotal / INVOICE_PAGE_SIZE));
	const isLoading = revenueQuery.isLoading;
	const hasError = revenueQuery.isError || invoiceQuery.isError;
	const asOf = end.getTime() < Date.now() ? new Date(end.getTime() - 1) : new Date();

	const metrics = [
		{
			label: 'Total amount invoiced',
			value: formatRevenueCurrency(toNumber(collection.total_invoiced), selectedCurrency),
			delta: calculateDelta(toNumber(collection.total_invoiced), toNumber(previousCollection.total_invoiced)),
			detail: `${collection.invoice_count} finalized invoice${collection.invoice_count === 1 ? '' : 's'}`,
		},
		{
			label: 'Collected against invoices',
			value: formatRevenueCurrency(toNumber(collection.total_paid), selectedCurrency),
			delta: calculateDelta(toNumber(collection.total_paid), toNumber(previousCollection.total_paid)),
			detail: `${collection.paid_invoice_count} fully paid`,
		},
		{
			label: 'Total amount unpaid',
			value: formatRevenueCurrency(toNumber(collection.total_unpaid), selectedCurrency),
			delta: calculateDelta(toNumber(collection.total_unpaid), toNumber(previousCollection.total_unpaid)),
			detail: `${collection.overdue_invoice_count} overdue`,
			inverseDelta: true,
		},
		{
			label: 'Total workspaces',
			value: collection.total_workspaces.toLocaleString(),
			delta: calculateDelta(collection.total_workspaces, previousCollection.total_workspaces),
			detail: 'Invoiced in this period',
		},
	];

	const changePeriod = (value: RevenueFilterValue) => {
		setSelectedFilter(value);
		setInvoicePage(1);
		setInvoiceSearch('');
	};

	return (
		<Page
			className='max-w-[1500px] px-6 lg:px-10'
			heading='Revenue'
			headingCTA={
				<div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row'>
					<div className='w-full sm:w-[170px]'>
						<Select
							options={currencies.map((currency) => ({ value: currency, label: currency.toUpperCase() }))}
							value={selectedCurrency}
							placeholder='Currency'
							disabled={currencies.length === 0}
							onChange={setSelectedCurrency}
						/>
					</div>
					<div className='w-full sm:w-[190px]'>
						<Select options={FILTER_OPTIONS} value={selectedFilter} onChange={(value) => changePeriod(value as RevenueFilterValue)} />
					</div>
				</div>
			}>
			<div className='space-y-8 pt-2'>
				<div className='flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-5'>
					<p className='max-w-2xl text-sm text-zinc-600'>
						Current balances for invoices in this period, grouped by service-period start or issue date for undated one-offs. Collections
						include prepaid credit purchases; service-period revenue excludes undated purchases. Currencies are kept separate.
					</p>
					<div className='flex items-center gap-2 text-xs text-zinc-500'>
						<span>
							{formatDate(startIso)} – {formatDate(endIso)}
						</span>
						<span aria-hidden='true'>·</span>
						<span>No FX conversion</span>
					</div>
				</div>

				{hasError && (
					<div
						role='alert'
						className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950'>
						<span>Some revenue data could not be loaded. Retry before making a collection decision.</span>
						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={() => void Promise.all([revenueQuery.refetch(), invoiceQuery.refetch()])}>
							Retry
						</Button>
					</div>
				)}

				<section aria-labelledby='revenue-overview-title'>
					<h2 id='revenue-overview-title' className='sr-only'>
						Revenue overview
					</h2>
					<div className='grid overflow-hidden rounded-md border border-zinc-200 bg-white sm:grid-cols-2 xl:grid-cols-4'>
						{metrics.map((metric, index) => (
							<MetricCard key={metric.label} {...metric} loading={isLoading} index={index} />
						))}
					</div>
				</section>

				<section className='grid gap-5 xl:grid-cols-2' aria-label='Revenue trends'>
					<TrendPanel
						title='Service-period revenue'
						detail='Finalized, dated line items in this invoice cohort; not an accounting recognition schedule'
						loading={isLoading}
						empty={graphData.length === 0}
						legend={[{ label: 'Recognized', color: 'bg-zinc-900' }]}>
						<ChartContainer config={{ recognized: { label: 'Recognized', color: '#18181b' } }} className='h-[280px] w-full aspect-auto'>
							<AreaChart data={graphData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
								<CartesianGrid vertical={false} strokeDasharray='3 3' />
								<XAxis dataKey='label' tickFormatter={formatGraphLabel} tickLine={false} axisLine={false} minTickGap={24} />
								<YAxis
									width={72}
									tickFormatter={(value) => formatCompactCurrency(Number(value), selectedCurrency)}
									tickLine={false}
									axisLine={false}
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											labelFormatter={(label) => formatGraphLabel(String(label))}
											formatter={(value) => (
												<ChartValue label='Recognized' value={formatRevenueCurrency(Number(value), selectedCurrency)} />
											)}
										/>
									}
								/>
								<Area
									type='monotone'
									dataKey='recognized'
									stroke='var(--color-recognized)'
									fill='var(--color-recognized)'
									fillOpacity={0.1}
									strokeWidth={2}
									activeDot={{ r: 4 }}
								/>
							</AreaChart>
						</ChartContainer>
					</TrendPanel>

					<TrendPanel
						title='Invoice collection'
						detail='Current paid balances grouped by invoice date, not payment or refund date'
						loading={isLoading}
						empty={graphData.length === 0}
						legend={[
							{ label: 'Invoiced', color: 'bg-sky-700' },
							{ label: 'Paid', color: 'bg-emerald-600' },
						]}>
						<ChartContainer
							config={{ invoiced: { label: 'Invoiced', color: '#0369a1' }, paid: { label: 'Paid', color: '#059669' } }}
							className='h-[280px] w-full aspect-auto'>
							<LineChart data={graphData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
								<CartesianGrid vertical={false} strokeDasharray='3 3' />
								<XAxis dataKey='label' tickFormatter={formatGraphLabel} tickLine={false} axisLine={false} minTickGap={24} />
								<YAxis
									width={72}
									tickFormatter={(value) => formatCompactCurrency(Number(value), selectedCurrency)}
									tickLine={false}
									axisLine={false}
								/>
								<ChartTooltip
									content={
										<ChartTooltipContent
											labelFormatter={(label) => formatGraphLabel(String(label))}
											formatter={(value, name) => (
												<ChartValue
													label={name === 'paid' ? 'Paid' : 'Invoiced'}
													value={formatRevenueCurrency(Number(value), selectedCurrency)}
												/>
											)}
										/>
									}
								/>
								<Line type='monotone' dataKey='invoiced' stroke='var(--color-invoiced)' strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
								<Line type='monotone' dataKey='paid' stroke='var(--color-paid)' strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
							</LineChart>
						</ChartContainer>
					</TrendPanel>
				</section>

				<section className='space-y-3' aria-labelledby='invoice-table-title'>
					<SectionHeading
						id='invoice-table-title'
						title='Invoices'
						detail={`${invoiceTotal} finalized invoice${invoiceTotal === 1 ? '' : 's'} · Select a row for payment detail`}
					/>
					<div className='flex items-center justify-between gap-3'>
						<SearchBar value={invoiceSearch} placeholder='Search invoice number or reference' onChange={setInvoiceSearch} />
						<span className='hidden text-xs uppercase tracking-wide text-zinc-400 sm:block'>{selectedCurrency}</span>
					</div>
					<div className='overflow-x-auto rounded-md border border-zinc-200 bg-white'>
						<Table>
							<TableHeader className='bg-zinc-50'>
								<TableRow>
									<TableHead className='min-w-[210px] pl-4'>Invoice & reference</TableHead>
									<TableHead className='min-w-[180px]'>Workspace</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Issued</TableHead>
									<TableHead>Due</TableHead>
									<TableHead className='text-right'>Invoiced</TableHead>
									<TableHead className='text-right'>Paid</TableHead>
									<TableHead className='text-right'>Unpaid</TableHead>
									<TableHead className='w-10'>
										<span className='sr-only'>Open details</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{invoiceQuery.isLoading && <LoadingTableRow columns={9} />}
								{invoiceQuery.data?.items.map((invoice) => {
									const label = getPaymentLabel(invoice, new Date());
									return (
										<TableRow key={invoice.id} className='cursor-pointer hover:bg-zinc-50' onClick={() => setSelectedInvoiceId(invoice.id)}>
											<TableCell className='pl-4'>
												<button
													type='button'
													className='block max-w-[230px] rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2'
													onClick={(event) => {
														event.stopPropagation();
														setSelectedInvoiceId(invoice.id);
													}}
													aria-label={`Open ${invoice.invoice_number || invoice.id} details`}>
													<span className='block font-medium text-zinc-950'>{invoice.invoice_number || 'Number pending'}</span>
													<span className='mt-0.5 block truncate font-mono text-[11px] text-zinc-500'>
														{invoice.idempotency_key || invoice.id}
													</span>
												</button>
											</TableCell>
											<TableCell>{invoice.customer?.name || invoice.customer_id || '—'}</TableCell>
											<TableCell>
												<PaymentStatus label={label} />
											</TableCell>
											<TableCell>{formatDate(invoice.finalized_at || invoice.created_at)}</TableCell>
											<TableCell>{formatDate(invoice.due_date)}</TableCell>
											<TableCell className='text-right tabular-nums'>
												{formatRevenueCurrency(toNumber(invoice.amount_due), invoice.currency)}
											</TableCell>
											<TableCell className='text-right tabular-nums'>
												{formatRevenueCurrency(toNumber(invoice.amount_paid), invoice.currency)}
											</TableCell>
											<TableCell className='text-right font-medium tabular-nums'>
												{formatRevenueCurrency(toNumber(invoice.amount_remaining), invoice.currency)}
											</TableCell>
											<TableCell>
												<ChevronRightIcon className='h-4 w-4 text-zinc-400' aria-hidden='true' />
											</TableCell>
										</TableRow>
									);
								})}
								{!invoiceQuery.isLoading && (invoiceQuery.data?.items.length ?? 0) === 0 && (
									<TableRow>
										<TableCell colSpan={9} className='py-12 text-center text-sm text-zinc-500'>
											{debouncedInvoiceSearch ? 'No invoices match that number or reference.' : 'No finalized invoices in this period.'}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
					<Pagination page={invoicePage} pages={invoicePages} onChange={setInvoicePage} />
				</section>

				<section className='space-y-3' aria-labelledby='aging-title'>
					<SectionHeading id='aging-title' title='Aging analysis' detail={`Outstanding balances as of ${formatDate(asOf.toISOString())}`} />
					<div className='overflow-x-auto rounded-md border border-zinc-200 bg-white'>
						<Table>
							<TableHeader className='bg-zinc-50'>
								<TableRow>
									<TableHead className='min-w-[220px] pl-4'>Workspace</TableHead>
									<TableHead className='text-right'>Current</TableHead>
									<TableHead className='text-right'>1–30 days</TableHead>
									<TableHead className='text-right'>31–60 days</TableHead>
									<TableHead className='text-right'>61–90 days</TableHead>
									<TableHead className='text-right'>91+ days</TableHead>
									<TableHead className='text-right'>Total outstanding</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading && <LoadingTableRow columns={7} />}
								{aging.map((row) => (
									<AgingTableRow key={row.workspace_id} row={row} currency={selectedCurrency} />
								))}
								{!isLoading && aging.length === 0 && (
									<TableRow>
										<TableCell colSpan={7} className='py-12 text-center text-sm text-zinc-500'>
											No outstanding balances for this currency and period.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</section>

				<section className='space-y-3' aria-labelledby='revenue-leaders-title'>
					<SectionHeading id='revenue-leaders-title' title='Revenue leaders' detail='Top five by recognized revenue' />
					<div className='grid gap-5 md:grid-cols-2'>
						<RankingPanel
							title='Top apps'
							detail='Plan metadata attribution'
							items={leaderboards.apps}
							currency={selectedCurrency}
							icon={<Building2 className='h-4 w-4' />}
						/>
						<RankingPanel
							title='Top users'
							detail='Billing owner attribution'
							items={leaderboards.users}
							currency={selectedCurrency}
							icon={<Users className='h-4 w-4' />}
						/>
						<RankingPanel
							title='Top plans'
							detail='Finalized invoice line items'
							items={leaderboards.plans}
							currency={selectedCurrency}
							icon={<FileText className='h-4 w-4' />}
						/>
						<RankingPanel
							title='Top workspaces'
							detail='Customer revenue attribution'
							items={leaderboards.workspaces}
							currency={selectedCurrency}
							icon={<Building2 className='h-4 w-4' />}
						/>
					</div>
				</section>
			</div>

			<InvoiceDetailSheet
				invoiceId={selectedInvoiceId}
				onClose={() => setSelectedInvoiceId(null)}
				onOpenFull={(invoiceId) => navigate(`${RouteNames.invoices}/${invoiceId}`)}
			/>
		</Page>
	);
};

const MetricCard = ({
	label,
	value,
	delta,
	detail,
	loading,
	index,
	inverseDelta = false,
}: {
	label: string;
	value: string;
	delta: { label: string; positive: boolean } | null;
	detail: string;
	loading: boolean;
	index: number;
	inverseDelta?: boolean;
}) => {
	const favourable = delta ? (inverseDelta ? !delta.positive : delta.positive) : false;
	return (
		<div
			className={cn(
				'min-h-[148px] p-5',
				index === 1 && 'border-t border-zinc-200 sm:border-l sm:border-t-0',
				index === 2 && 'border-t border-zinc-200 xl:border-l xl:border-t-0',
				index === 3 && 'border-t border-zinc-200 sm:border-l xl:border-t-0',
			)}>
			<p className='text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500'>{label}</p>
			{loading ? (
				<Skeleton className='mt-4 h-8 w-32' />
			) : (
				<p className='mt-3 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums'>{value}</p>
			)}
			<div className='mt-3 flex items-center gap-2 text-xs'>
				{delta && (
					<span className={cn('inline-flex items-center gap-1 font-medium', favourable ? 'text-emerald-700' : 'text-amber-700')}>
						{delta.positive ? <ArrowUpRight className='h-3.5 w-3.5' /> : <ArrowDownRight className='h-3.5 w-3.5' />}
						{delta.label}
						<span className='sr-only'>{delta.positive ? 'increase' : 'decrease'}</span>
					</span>
				)}
				<span className='text-zinc-500'>{detail}</span>
			</div>
		</div>
	);
};

const TrendPanel = ({
	title,
	detail,
	legend,
	loading,
	empty,
	children,
}: {
	title: string;
	detail: string;
	legend: { label: string; color: string }[];
	loading: boolean;
	empty: boolean;
	children: React.ReactNode;
}) => (
	<div className='rounded-md border border-zinc-200 bg-white p-5'>
		<div className='flex flex-wrap items-start justify-between gap-3'>
			<div>
				<h2 className='text-sm font-semibold text-zinc-950'>{title}</h2>
				<p className='mt-1 text-xs text-zinc-500'>{detail}</p>
			</div>
			<div className='flex items-center gap-3'>
				{legend.map((item) => (
					<span key={item.label} className='inline-flex items-center gap-1.5 text-xs text-zinc-500'>
						<span className={cn('h-2 w-2 rounded-full', item.color)} aria-hidden='true' />
						{item.label}
					</span>
				))}
			</div>
		</div>
		<div className='mt-5'>{loading ? <Skeleton className='h-[280px] w-full' /> : empty ? <ChartEmptyState /> : children}</div>
	</div>
);

const ChartEmptyState = () => (
	<div className='flex h-[280px] items-center justify-center border-t border-dashed border-zinc-200 text-sm text-zinc-500'>
		No finalized revenue in this period.
	</div>
);

const ChartValue = ({ label, value }: { label: string; value: string }) => (
	<div className='flex min-w-[150px] items-center justify-between gap-4'>
		<span className='text-zinc-500'>{label}</span>
		<span className='font-mono font-medium tabular-nums text-zinc-950'>{value}</span>
	</div>
);

const SectionHeading = ({ id, title, detail }: { id: string; title: string; detail: string }) => (
	<div className='flex flex-wrap items-end justify-between gap-2'>
		<h2 id={id} className='text-base font-semibold text-zinc-950'>
			{title}
		</h2>
		<p className='text-xs text-zinc-500'>{detail}</p>
	</div>
);

const SearchBar = ({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) => (
	<div className='relative w-full max-w-sm'>
		<Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400' aria-hidden='true' />
		<Input
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
			className='h-9 bg-white pl-9 text-[13px]'
		/>
	</div>
);

const PaymentStatus = ({ label }: { label: ReturnType<typeof getPaymentLabel> }) => (
	<span
		className={cn(
			'inline-flex items-center gap-1.5 text-xs font-medium',
			label === 'Paid' && 'text-emerald-700',
			label === 'Overdue' && 'text-amber-700',
			label === 'Failed' && 'text-red-700',
			(label === 'Pending' || label === 'Processing') && 'text-zinc-600',
		)}>
		<span
			className={cn(
				'h-1.5 w-1.5 rounded-full bg-zinc-400',
				label === 'Paid' && 'bg-emerald-600',
				label === 'Overdue' && 'bg-amber-600',
				label === 'Failed' && 'bg-red-600',
			)}
			aria-hidden='true'
		/>
		{label}
	</span>
);

const AgingTableRow = ({ row, currency }: { row: RevenueAgingRow; currency: string }) => (
	<TableRow>
		<TableCell className='pl-4 font-medium text-zinc-950'>{row.workspace_name}</TableCell>
		{[row.current, row.days_1_30, row.days_31_60, row.days_61_90, row.days_91_plus].map((value, index) => (
			<TableCell key={index} className={cn('text-right tabular-nums', index > 0 && toNumber(value) > 0 && 'text-amber-700')}>
				{formatRevenueCurrency(toNumber(value), currency)}
			</TableCell>
		))}
		<TableCell className='text-right font-semibold tabular-nums text-zinc-950'>
			{formatRevenueCurrency(toNumber(row.total_outstanding), currency)}
		</TableCell>
	</TableRow>
);

const RankingPanel = ({
	title,
	detail,
	items,
	currency,
	icon,
}: {
	title: string;
	detail: string;
	items: RevenueLeaderboardItem[];
	currency: string;
	icon: React.ReactNode;
}) => {
	const maximum = Math.max(...items.map((item) => toNumber(item.value)), 0);
	return (
		<div className='rounded-md border border-zinc-200 bg-white p-5'>
			<div className='flex items-start gap-3'>
				<div className='mt-0.5 text-zinc-500'>{icon}</div>
				<div>
					<h3 className='text-sm font-semibold text-zinc-950'>{title}</h3>
					<p className='mt-1 text-xs text-zinc-500'>{detail}</p>
				</div>
			</div>
			<div className='mt-5 space-y-4'>
				{items.map((item, index) => {
					const width = maximum > 0 ? Math.max(2, (toNumber(item.value) / maximum) * 100) : 0;
					return (
						<div key={item.id}>
							<div className='flex items-center justify-between gap-4 text-xs'>
								<span className='min-w-0 truncate text-zinc-700'>
									<span className='mr-2 text-zinc-400'>{index + 1}</span>
									{item.label}
								</span>
								<span className='shrink-0 font-medium tabular-nums text-zinc-950'>
									{formatRevenueCurrency(toNumber(item.value), currency)}
								</span>
							</div>
							<svg className='mt-2 h-1.5 w-full overflow-visible' viewBox='0 0 100 6' preserveAspectRatio='none' aria-hidden='true'>
								<rect x='0' y='0' width='100' height='6' rx='3' fill='#f4f4f5' />
								<rect x='0' y='0' width={width} height='6' rx='3' fill='#27272a' />
							</svg>
						</div>
					);
				})}
				{items.length === 0 && <p className='py-10 text-center text-sm text-zinc-500'>No attributable revenue in this period.</p>}
			</div>
		</div>
	);
};

const LoadingTableRow = ({ columns }: { columns: number }) => (
	<TableRow>
		<TableCell colSpan={columns} className='p-4'>
			<Skeleton className='h-10 w-full' />
		</TableCell>
	</TableRow>
);

const Pagination = ({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) => {
	if (pages <= 1) return null;
	return (
		<div className='flex items-center justify-end gap-2 pt-1'>
			<span className='text-xs text-zinc-500'>
				Page {page} of {pages}
			</span>
			<Button
				type='button'
				variant='outline'
				size='icon'
				className='size-8'
				aria-label='Previous invoice page'
				disabled={page === 1}
				onClick={() => onChange(page - 1)}>
				<ChevronLeft className='h-4 w-4' />
			</Button>
			<Button
				type='button'
				variant='outline'
				size='icon'
				className='size-8'
				aria-label='Next invoice page'
				disabled={page === pages}
				onClick={() => onChange(page + 1)}>
				<ChevronRight className='h-4 w-4' />
			</Button>
		</div>
	);
};

const InvoiceDetailSheet = ({
	invoiceId,
	onClose,
	onOpenFull,
}: {
	invoiceId: string | null;
	onClose: () => void;
	onOpenFull: (id: string) => void;
}) => {
	const { activeEnvironment } = useEnvironment();
	const invoiceQuery = useQuery({
		queryKey: ['revenue-invoice-detail', activeEnvironment?.id, invoiceId],
		enabled: Boolean(invoiceId),
		queryFn: () => InvoiceApi.getInvoiceById(invoiceId!),
	});
	const paymentsQuery = useQuery({
		queryKey: ['revenue-invoice-payments', activeEnvironment?.id, invoiceId],
		enabled: Boolean(invoiceId),
		queryFn: () => PaymentApi.getAllPayments({ limit: 50, offset: 0, destination_id: invoiceId!, destination_type: 'INVOICE' }),
	});
	const downloadMutation = useMutation({
		mutationFn: async () => {
			if (invoiceId) await InvoiceApi.getInvoicePdf(invoiceId, invoiceQuery.data?.invoice_number);
		},
		onError: () => toast.error('Could not download this invoice PDF.'),
	});
	const invoice = invoiceQuery.data;
	const status = invoice ? getPaymentLabel(invoice, new Date()) : null;

	return (
		<Sheet
			open={Boolean(invoiceId)}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}>
			<SheetContent
				side='right'
				className='m-0 flex h-full max-h-screen w-[min(94vw,680px)] flex-col rounded-none p-0 sm:max-w-[680px] motion-reduce:duration-0'>
				<div className='sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-5 pr-12'>
					<SheetHeader>
						<SheetTitle>{invoice?.invoice_number || 'Invoice details'}</SheetTitle>
						<SheetDescription>{invoice?.idempotency_key || invoiceId || 'Loading invoice information'}</SheetDescription>
					</SheetHeader>
				</div>
				<div className='min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6'>
					{invoiceQuery.isLoading ? (
						<div className='space-y-3'>
							<Skeleton className='h-28 w-full' />
							<Skeleton className='h-48 w-full' />
						</div>
					) : invoiceQuery.isError || !invoice ? (
						<div role='alert' className='rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900'>
							Invoice detail could not be loaded.
						</div>
					) : (
						<>
							<div className='flex items-start justify-between gap-4'>
								<div>
									<p className='text-xs uppercase tracking-wide text-zinc-500'>Workspace</p>
									<p className='mt-1 font-medium text-zinc-950'>{invoice.customer?.name || invoice.customer_id}</p>
								</div>
								{status && <PaymentStatus label={status} />}
							</div>

							<div className='grid grid-cols-3 overflow-hidden rounded-md border border-zinc-200'>
								<SheetAmount label='Invoiced' value={invoice.amount_due} currency={invoice.currency} />
								<SheetAmount label='Paid' value={invoice.amount_paid} currency={invoice.currency} divided />
								<SheetAmount label='Unpaid' value={invoice.amount_remaining} currency={invoice.currency} divided />
							</div>

							<div className='grid grid-cols-2 gap-x-6 gap-y-4 border-y border-zinc-200 py-5 text-sm'>
								<DetailField label='Issued' value={formatDate(invoice.finalized_at || invoice.created_at)} />
								<DetailField label='Due' value={formatDate(invoice.due_date)} />
								<DetailField label='Service period' value={`${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`} />
								<DetailField
									label='Billing reason'
									value={String(invoice.billing_reason || '—')
										.replace(/_/g, ' ')
										.toLowerCase()}
									capitalize
								/>
							</div>

							<div>
								<h3 className='text-sm font-semibold text-zinc-950'>Line items</h3>
								<div className='mt-3 divide-y divide-zinc-200 border-y border-zinc-200'>
									{invoice.line_items?.map((lineItem) => (
										<div key={lineItem.id} className='flex items-start justify-between gap-4 py-3 text-sm'>
											<div className='min-w-0'>
												<p className='truncate font-medium text-zinc-800'>
													{lineItem.display_name || lineItem.plan_display_name || lineItem.meter_display_name || 'Invoice item'}
												</p>
												<p className='mt-0.5 text-xs text-zinc-500'>Quantity {lineItem.quantity}</p>
											</div>
											<span className='shrink-0 font-medium tabular-nums'>
												{formatRevenueCurrency(toNumber(lineItem.amount), invoice.currency)}
											</span>
										</div>
									))}
									{(!invoice.line_items || invoice.line_items.length === 0) && (
										<p className='py-6 text-sm text-zinc-500'>No line items returned.</p>
									)}
								</div>
							</div>

							<div>
								<h3 className='text-sm font-semibold text-zinc-950'>Payment records</h3>
								<div className='mt-3 divide-y divide-zinc-200 border-y border-zinc-200'>
									{paymentsQuery.isLoading && <Skeleton className='my-3 h-12 w-full' />}
									{paymentsQuery.data?.items.map((payment) => (
										<div key={payment.id} className='flex items-start justify-between gap-4 py-3 text-sm'>
											<div>
												<p className='font-medium capitalize text-zinc-800'>
													{String(payment.payment_status).toLowerCase().replace(/_/g, ' ')}
												</p>
												<p className='mt-0.5 font-mono text-[11px] text-zinc-500'>
													{payment.gateway_tracking_id || payment.idempotency_key || payment.id}
												</p>
											</div>
											<span className='shrink-0 font-medium tabular-nums'>
												{formatRevenueCurrency(toNumber(payment.amount), payment.currency)}
											</span>
										</div>
									))}
									{!paymentsQuery.isLoading && (paymentsQuery.data?.items.length ?? 0) === 0 && (
										<p className='py-6 text-sm text-zinc-500'>No payment attempts recorded.</p>
									)}
								</div>
							</div>

							<div className='flex flex-col gap-2 border-t border-zinc-200 pt-5 sm:flex-row'>
								<Button type='button' className='sm:flex-1' onClick={() => onOpenFull(invoice.id)}>
									<ExternalLink className='mr-2 h-4 w-4' /> Open full invoice
								</Button>
								<Button
									type='button'
									variant='outline'
									className='sm:flex-1'
									disabled={downloadMutation.isPending}
									onClick={() => downloadMutation.mutate()}>
									<Download className='mr-2 h-4 w-4' /> {downloadMutation.isPending ? 'Preparing PDF…' : 'Download PDF'}
								</Button>
							</div>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};

const SheetAmount = ({
	label,
	value,
	currency,
	divided = false,
}: {
	label: string;
	value: number;
	currency: string;
	divided?: boolean;
}) => (
	<div className={cn('p-4', divided && 'border-l border-zinc-200')}>
		<p className='text-[10px] uppercase tracking-wide text-zinc-500'>{label}</p>
		<p className='mt-1 text-sm font-semibold tabular-nums text-zinc-950'>{formatRevenueCurrency(toNumber(value), currency)}</p>
	</div>
);

const DetailField = ({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) => (
	<div>
		<p className='text-xs text-zinc-500'>{label}</p>
		<p className={cn('mt-1 text-zinc-900', capitalize && 'capitalize')}>{value}</p>
	</div>
);

export default Revenue;
