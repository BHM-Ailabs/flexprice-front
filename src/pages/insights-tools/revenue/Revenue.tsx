import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Page, Select } from '@/components/atoms';
import { RedirectCell, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/molecules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import InvoiceApi from '@/api/InvoiceApi';
import RevenueDashboardApi from '@/api/RevenueDashboardApi';
import { RouteNames } from '@/core/routes/Routes';
import { INVOICE_STATUS, type Invoice } from '@/models/Invoice';
import { SortDirection } from '@/types/common/QueryBuilder';
import type { RevenueDashboardSummary } from '@/types/dto/RevenueDashboard';
import { buildInvoiceCollectionSummaries, formatRevenueCurrency, type InvoiceCollectionSummary } from '@/lib/revenueDashboard';
import { cn } from '@/lib/utils';

type RevenueFilterValue = 'this_month' | 'this_quarter' | 'this_year' | 'last_month' | 'last_quarter' | 'last_year';

const FILTER_OPTIONS = [
	{ value: 'this_month', label: 'This month' },
	{ value: 'this_quarter', label: 'This quarter' },
	{ value: 'this_year', label: 'This year' },
	{ value: 'last_month', label: 'Last month' },
	{ value: 'last_quarter', label: 'Last quarter' },
	{ value: 'last_year', label: 'Last year' },
] satisfies { value: RevenueFilterValue; label: string }[];

const CUSTOMER_PAGE_SIZE = 20;
const INVOICE_PAGE_SIZE = 10;

const getDateRangeForPeriod = (period: RevenueFilterValue) => {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = now.getUTCMonth();
	const utcMonth = (targetYear: number, targetMonth: number) => new Date(Date.UTC(targetYear, targetMonth, 1));

	switch (period) {
		case 'this_month':
			return { start: utcMonth(year, month), end: utcMonth(year, month + 1) };
		case 'last_month':
			return { start: utcMonth(year, month - 1), end: utcMonth(year, month) };
		case 'this_quarter': {
			const quarterStart = Math.floor(month / 3) * 3;
			return { start: utcMonth(year, quarterStart), end: utcMonth(year, quarterStart + 3) };
		}
		case 'last_quarter': {
			const quarterStart = Math.floor(month / 3) * 3;
			return { start: utcMonth(year, quarterStart - 3), end: utcMonth(year, quarterStart) };
		}
		case 'this_year':
			return { start: utcMonth(year, 0), end: utcMonth(year + 1, 0) };
		case 'last_year':
			return { start: utcMonth(year - 1, 0), end: utcMonth(year, 0) };
	}
};

const toNumberOrNull = (value: unknown): number | null => {
	if (value == null) return null;
	const numeric = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(numeric) ? numeric : null;
};

const formatDate = (value: string | undefined): string => {
	if (!value) return '--';
	return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const paymentLabel = (invoice: Invoice, now: Date): string => {
	if (Number(invoice.amount_remaining ?? 0) <= 0 && Number(invoice.amount_due ?? 0) > 0) return 'Paid';
	if (invoice.due_date && new Date(invoice.due_date) < now) return 'Overdue';
	const normalized = String(invoice.payment_status || 'pending').toLowerCase();
	return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, ' ');
};

interface CurrencyRow {
	currency: string;
	recognized: number | null;
	contract: number | null;
	usage: number | null;
	collection: InvoiceCollectionSummary | null;
}

const Revenue = () => {
	const [selectedFilter, setSelectedFilter] = useState<RevenueFilterValue>('this_quarter');
	const [customerPage, setCustomerPage] = useState(1);
	const [invoicePage, setInvoicePage] = useState(1);
	const [customerSearch, setCustomerSearch] = useState('');
	const [invoiceSearch, setInvoiceSearch] = useState('');
	const { start, end } = useMemo(() => getDateRangeForPeriod(selectedFilter), [selectedFilter]);
	const startIso = start.toISOString();
	const endIso = end.toISOString();
	const inclusiveEndIso = new Date(end.getTime() - 1).toISOString();

	const revenueQuery = useQuery({
		queryKey: ['revenue-dashboard', selectedFilter, startIso, endIso],
		queryFn: () =>
			RevenueDashboardApi.getRevenueDashboard({
				period_start: startIso,
				period_end: endIso,
				customer_ids: [],
			}),
	});

	const invoiceQuery = useQuery({
		queryKey: ['revenue-invoices', selectedFilter, startIso, inclusiveEndIso],
		queryFn: () =>
			InvoiceApi.listInvoices({
				limit: 1000,
				offset: 0,
				invoice_status: [INVOICE_STATUS.FINALIZED],
				period_start_gte: startIso,
				period_start_lte: inclusiveEndIso,
				skip_line_items: true,
				sort: [{ field: 'created_at', direction: SortDirection.DESC }],
			}),
	});

	const summaries = useMemo(() => revenueQuery.data?.summaries ?? {}, [revenueQuery.data?.summaries]);
	const customers = revenueQuery.data?.items ?? [];
	const invoices = useMemo(() => invoiceQuery.data?.items ?? [], [invoiceQuery.data?.items]);
	const collectionSummaries = useMemo(() => buildInvoiceCollectionSummaries(invoices), [invoices]);
	const collectionByCurrency = useMemo(
		() => new Map(collectionSummaries.map((summary) => [summary.currency, summary])),
		[collectionSummaries],
	);
	const currencyRows = useMemo<CurrencyRow[]>(() => {
		const currencies = new Set([...Object.keys(summaries), ...collectionSummaries.map((summary) => summary.currency)]);
		return [...currencies]
			.sort((left, right) => left.localeCompare(right))
			.map((currency) => {
				const summary: RevenueDashboardSummary | undefined = summaries[currency];
				return {
					currency,
					recognized: toNumberOrNull(summary?.total_revenue),
					contract: toNumberOrNull(summary?.total_fixed_revenue),
					usage: toNumberOrNull(summary?.total_usage_revenue),
					collection: collectionByCurrency.get(currency) ?? null,
				};
			});
	}, [collectionByCurrency, collectionSummaries, summaries]);

	const filteredCustomers = customerSearch.trim()
		? customers.filter((row) =>
				(row.customer_name || row.external_customer_id || '').toLowerCase().includes(customerSearch.trim().toLowerCase()),
			)
		: customers;
	const customerPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE));
	const pagedCustomers = filteredCustomers.slice((customerPage - 1) * CUSTOMER_PAGE_SIZE, customerPage * CUSTOMER_PAGE_SIZE);

	const filteredInvoices = invoiceSearch.trim()
		? invoices.filter((invoice) => {
				const query = invoiceSearch.trim().toLowerCase();
				return [invoice.invoice_number, invoice.customer?.name, invoice.customer_id].some((value) =>
					String(value ?? '')
						.toLowerCase()
						.includes(query),
				);
			})
		: invoices;
	const invoicePages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICE_PAGE_SIZE));
	const pagedInvoices = filteredInvoices.slice((invoicePage - 1) * INVOICE_PAGE_SIZE, invoicePage * INVOICE_PAGE_SIZE);
	const loading = revenueQuery.isLoading || invoiceQuery.isLoading;
	const hasError = revenueQuery.isError || invoiceQuery.isError;
	const hasData = currencyRows.length > 0 || customers.length > 0 || invoices.length > 0;
	const now = new Date();

	const changePeriod = (value: RevenueFilterValue) => {
		setSelectedFilter(value);
		setCustomerPage(1);
		setInvoicePage(1);
		setCustomerSearch('');
		setInvoiceSearch('');
	};

	return (
		<Page
			heading='Revenue'
			headingCTA={
				<div className='w-[220px]'>
					<Select options={FILTER_OPTIONS} value={selectedFilter} onChange={(value) => changePeriod(value as RevenueFilterValue)} />
				</div>
			}>
			<div className='space-y-8 pt-3'>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<p className='text-sm text-zinc-500'>Recognized revenue and invoice collection, kept separate by currency.</p>
					<p className='text-xs text-zinc-400'>
						{formatDate(startIso)} – {formatDate(inclusiveEndIso)}
					</p>
				</div>

				{hasError && (
					<div className='rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'>
						Some revenue data could not be loaded. Retry this page before making a collection decision.
					</div>
				)}

				<section className='space-y-3'>
					<SectionHeading title='Revenue by currency' detail='No automatic FX conversion is applied' />
					<div className='overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm'>
						<Table>
							<TableHeader className='bg-gray-50'>
								<TableRow>
									<TableHead className='pl-4'>Currency</TableHead>
									<TableHead>Recognized</TableHead>
									<TableHead>Contract</TableHead>
									<TableHead>Usage</TableHead>
									<TableHead>Invoiced</TableHead>
									<TableHead>Collected</TableHead>
									<TableHead>Outstanding</TableHead>
									<TableHead>Overdue</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading && currencyRows.length === 0 ? (
									<TableRow>
										<TableCell colSpan={8} className='p-4'>
											<Skeleton className='h-8 w-full' />
										</TableCell>
									</TableRow>
								) : (
									currencyRows.map((row) => (
										<TableRow key={row.currency}>
											<TableCell className='pl-4 font-semibold uppercase'>{row.currency}</TableCell>
											<TableCell>{formatRevenueCurrency(row.recognized, row.currency)}</TableCell>
											<TableCell>{formatRevenueCurrency(row.contract, row.currency)}</TableCell>
											<TableCell>{formatRevenueCurrency(row.usage, row.currency)}</TableCell>
											<TableCell>{formatRevenueCurrency(row.collection?.invoiced ?? null, row.currency)}</TableCell>
											<TableCell className='font-medium text-emerald-700'>
												{formatRevenueCurrency(row.collection?.collected ?? null, row.currency)}
											</TableCell>
											<TableCell>{formatRevenueCurrency(row.collection?.outstanding ?? null, row.currency)}</TableCell>
											<TableCell className={cn((row.collection?.overdue ?? 0) > 0 && 'font-medium text-amber-700')}>
												{formatRevenueCurrency(row.collection?.overdue ?? null, row.currency)}
											</TableCell>
										</TableRow>
									))
								)}
								{!loading && currencyRows.length === 0 && (
									<TableRow>
										<TableCell colSpan={8} className='py-8 text-center text-sm text-zinc-500'>
											No finalized revenue is available in this period.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</section>

				<section className='space-y-3'>
					<SectionHeading title='Invoice collection' detail={`${invoices.length} finalized invoice${invoices.length === 1 ? '' : 's'}`} />
					<SearchBar
						value={invoiceSearch}
						placeholder='Search invoice or customer...'
						onChange={(value) => {
							setInvoiceSearch(value);
							setInvoicePage(1);
						}}
					/>
					<div className='overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm'>
						<Table>
							<TableHeader className='bg-gray-50'>
								<TableRow>
									<TableHead className='pl-4'>Issued</TableHead>
									<TableHead>Customer</TableHead>
									<TableHead>Invoice</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Due</TableHead>
									<TableHead>Invoiced</TableHead>
									<TableHead>Collected</TableHead>
									<TableHead>Outstanding</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{pagedInvoices.map((invoice) => {
									const overdue = paymentLabel(invoice, now) === 'Overdue';
									return (
										<TableRow key={invoice.id}>
											<TableCell className='pl-4'>{formatDate(invoice.finalized_at || invoice.created_at)}</TableCell>
											<TableCell>{invoice.customer?.name || invoice.customer_id || '--'}</TableCell>
											<TableCell>
												<RedirectCell redirectUrl={`${RouteNames.invoices}/${invoice.id}`}>
													{invoice.invoice_number || invoice.id}
												</RedirectCell>
											</TableCell>
											<TableCell className={cn(overdue ? 'font-medium text-amber-700' : 'text-zinc-600')}>
												{paymentLabel(invoice, now)}
											</TableCell>
											<TableCell>{formatDate(invoice.due_date)}</TableCell>
											<TableCell>{formatRevenueCurrency(Number(invoice.amount_due ?? 0), invoice.currency)}</TableCell>
											<TableCell>{formatRevenueCurrency(Number(invoice.amount_paid ?? 0), invoice.currency)}</TableCell>
											<TableCell>{formatRevenueCurrency(Number(invoice.amount_remaining ?? 0), invoice.currency)}</TableCell>
										</TableRow>
									);
								})}
								{!invoiceQuery.isLoading && pagedInvoices.length === 0 && (
									<TableRow>
										<TableCell colSpan={8} className='py-8 text-center text-sm text-zinc-500'>
											{invoiceSearch.trim() ? 'No invoices match this search.' : 'No finalized invoices in this period.'}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
					<Pagination page={invoicePage} pages={invoicePages} onChange={setInvoicePage} />
				</section>

				<section className='space-y-3'>
					<SectionHeading
						title='Customer revenue'
						detail={`${customers.length} customer-currency record${customers.length === 1 ? '' : 's'}`}
					/>
					<SearchBar
						value={customerSearch}
						placeholder='Search customers...'
						onChange={(value) => {
							setCustomerSearch(value);
							setCustomerPage(1);
						}}
					/>
					<div className='overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm'>
						<Table>
							<TableHeader className='bg-gray-50'>
								<TableRow>
									<TableHead className='pl-4'>Customer</TableHead>
									<TableHead>Currency</TableHead>
									<TableHead>Recognized</TableHead>
									<TableHead>Contract</TableHead>
									<TableHead>Usage</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{pagedCustomers.map((row) => (
									<TableRow key={`${row.customer_id}:${row.currency}`}>
										<TableCell className='pl-4'>
											<RedirectCell redirectUrl={`${RouteNames.customers}/${row.customer_id}`} allowRedirect={Boolean(row.customer_id)}>
												{row.customer_name || row.external_customer_id || 'Unknown'}
											</RedirectCell>
										</TableCell>
										<TableCell className='uppercase'>{row.currency}</TableCell>
										<TableCell className='font-medium'>{formatRevenueCurrency(toNumberOrNull(row.total_revenue), row.currency)}</TableCell>
										<TableCell>{formatRevenueCurrency(toNumberOrNull(row.total_fixed_revenue), row.currency)}</TableCell>
										<TableCell>{formatRevenueCurrency(toNumberOrNull(row.total_usage_revenue), row.currency)}</TableCell>
									</TableRow>
								))}
								{!revenueQuery.isLoading && pagedCustomers.length === 0 && (
									<TableRow>
										<TableCell colSpan={5} className='py-8 text-center text-sm text-zinc-500'>
											{customerSearch.trim() ? 'No customers match this search.' : '--'}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
					<Pagination page={customerPage} pages={customerPages} onChange={setCustomerPage} />
				</section>

				{!loading && !hasError && !hasData && (
					<div className='rounded-md border border-dashed border-gray-300 bg-white px-6 py-12 text-center'>
						<h2 className='text-lg font-semibold text-zinc-900'>No revenue in this range</h2>
						<p className='mt-2 text-sm text-zinc-500'>Choose another reporting period or finalize an invoice to populate this dashboard.</p>
					</div>
				)}
			</div>
		</Page>
	);
};

const SectionHeading = ({ title, detail }: { title: string; detail: string }) => (
	<div className='flex flex-wrap items-end justify-between gap-2'>
		<h2 className='text-base font-semibold text-zinc-900'>{title}</h2>
		<p className='text-xs text-zinc-400'>{detail}</p>
	</div>
);

const SearchBar = ({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) => (
	<div className='relative w-full max-w-xs'>
		<Search className='pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400' />
		<Input
			value={value}
			onChange={(event) => onChange(event.target.value)}
			placeholder={placeholder}
			className='h-8 bg-white pl-8 text-[13px]'
		/>
	</div>
);

const Pagination = ({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) => {
	if (pages <= 1) return null;
	return (
		<div className='flex items-center justify-end gap-2 pt-1'>
			<span className='text-xs text-zinc-400'>
				Page {page} of {pages}
			</span>
			<Button type='button' variant='outline' size='icon' className='size-8' disabled={page === 1} onClick={() => onChange(page - 1)}>
				<ChevronLeft className='h-4 w-4' />
			</Button>
			<Button type='button' variant='outline' size='icon' className='size-8' disabled={page === pages} onClick={() => onChange(page + 1)}>
				<ChevronRight className='h-4 w-4' />
			</Button>
		</div>
	);
};

export default Revenue;
