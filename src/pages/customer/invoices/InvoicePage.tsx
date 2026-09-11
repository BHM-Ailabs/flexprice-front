import { invoiceReference } from '@/utils/invoices/invoiceReference';
import { Page, Chip } from '@/components/atoms';
import { ApiDocsContent, RedirectCell } from '@/components/molecules';
import { ColumnData } from '@/components/molecules/Table';
import InvoiceTableMenu from '@/components/molecules/InvoiceTable/InvoiceTableMenu';
import { QueryableDataArea } from '@/components/organisms';
import GUIDES from '@/constants/guides';
import InvoiceApi from '@/api/InvoiceApi';
import CustomerApi from '@/api/CustomerApi';
import {
	FilterField,
	FilterFieldType,
	DEFAULT_OPERATORS_PER_DATA_TYPE,
	DataType,
	FilterOperator,
	SortOption,
	SortDirection,
	FilterCondition,
} from '@/types/common/QueryBuilder';
import { searchCustomersForFilter } from '@/utils/filterSearchHelpers';
import { ENTITY_STATUS } from '@/models';
import Customer from '@/models/Customer';
import { Invoice, INVOICE_STATUS, INVOICE_TYPE } from '@/models/Invoice';
import { PAYMENT_STATUS } from '@/constants';
import { useNavigate } from 'react-router';
import { RouteNames } from '@/core/routes/Routes';
import { formatDateShort, getCurrencySymbol } from '@/utils/common/helper_functions';
import { useCallback, useMemo, useState } from 'react';

const sortingOptions: SortOption[] = [
	{
		field: 'invoice_number',
		label: 'Legacy Invoice Number',
		direction: SortDirection.ASC,
	},
	{
		field: 'amount_due',
		label: 'Amount Due',
		direction: SortDirection.DESC,
	},
	{
		field: 'created_at',
		label: 'Created At',
		direction: SortDirection.DESC,
	},
	{
		field: 'due_date',
		label: 'Due Date',
		direction: SortDirection.ASC,
	},
];

const filterOptions: FilterField[] = [
	{
		field: 'invoice_reference',
		label: 'Invoice Number or Reference',
		fieldType: FilterFieldType.INPUT,
		operators: [FilterOperator.CONTAINS, FilterOperator.EQUAL],
		dataType: DataType.STRING,
	},
	{
		field: 'invoice_number',
		label: 'Legacy Invoice Number',
		fieldType: FilterFieldType.INPUT,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.STRING],
		dataType: DataType.STRING,
	},
	{
		field: 'customer_id',
		label: 'Customer',
		fieldType: FilterFieldType.ASYNC_MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		asyncConfig: {
			searchFn: searchCustomersForFilter,
		},
	},
	{
		field: 'invoice_status',
		label: 'Invoice Status',
		fieldType: FilterFieldType.MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		options: [
			{ value: INVOICE_STATUS.DRAFT, label: 'Draft' },
			{ value: INVOICE_STATUS.FINALIZED, label: 'Finalized' },
			{ value: INVOICE_STATUS.VOIDED, label: 'Voided' },
		],
	},
	{
		field: 'payment_status',
		label: 'Payment Status',
		fieldType: FilterFieldType.MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		options: [
			{ value: PAYMENT_STATUS.PENDING, label: 'Pending' },
			{ value: PAYMENT_STATUS.PROCESSING, label: 'Processing' },
			{ value: PAYMENT_STATUS.INITIATED, label: 'Initiated' },
			{ value: PAYMENT_STATUS.SUCCEEDED, label: 'Succeeded' },
			{ value: PAYMENT_STATUS.FAILED, label: 'Failed' },
			{ value: PAYMENT_STATUS.REFUNDED, label: 'Refunded' },
			{ value: PAYMENT_STATUS.PARTIALLY_REFUNDED, label: 'Partially Refunded' },
		],
	},
	{
		field: 'invoice_type',
		label: 'Invoice Type',
		fieldType: FilterFieldType.MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		options: [
			{ value: INVOICE_TYPE.SUBSCRIPTION, label: 'Subscription' },
			{ value: INVOICE_TYPE.ONE_OFF, label: 'One Off' },
			{ value: INVOICE_TYPE.CREDIT, label: 'Credit' },
		],
	},
	{
		field: 'created_at',
		label: 'Created At',
		fieldType: FilterFieldType.DATEPICKER,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.DATE],
		dataType: DataType.DATE,
	},
	{
		field: 'due_date',
		label: 'Due Date',
		fieldType: FilterFieldType.DATEPICKER,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.DATE],
		dataType: DataType.DATE,
	},
	{
		field: 'status',
		label: 'Status',
		fieldType: FilterFieldType.MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		options: [
			{ value: ENTITY_STATUS.PUBLISHED, label: 'Active' },
			{ value: ENTITY_STATUS.ARCHIVED, label: 'Inactive' },
		],
	},
];

const initialFilters: FilterCondition[] = [
	{
		field: 'invoice_reference',
		operator: FilterOperator.CONTAINS,
		valueString: '',
		dataType: DataType.STRING,
		id: 'initial-invoice-number',
	},
	{
		field: 'status',
		operator: FilterOperator.IN,
		valueArray: [ENTITY_STATUS.PUBLISHED],
		dataType: DataType.ARRAY,
		id: 'initial-status',
	},
];

const initialSorts: SortOption[] = [
	{
		field: 'created_at',
		label: 'Created At',
		direction: SortDirection.DESC,
	},
];

const getStatusChip = (status: string) => {
	switch (status.toUpperCase()) {
		case INVOICE_STATUS.VOIDED:
			return <Chip variant='default' label='Void' />;
		case INVOICE_STATUS.FINALIZED:
			return <Chip variant='success' label='Finalized' />;
		case INVOICE_STATUS.DRAFT:
			return <Chip variant='default' label='Draft' />;
		default:
			return <Chip variant='default' label='Draft' />;
	}
};

const getPaymentStatusChip = (status: string) => {
	switch (status.toUpperCase()) {
		case PAYMENT_STATUS.PENDING:
			return <Chip variant='warning' label='Pending' />;
		case PAYMENT_STATUS.INITIATED:
			return <Chip variant='warning' label='Initiated' />;
		case PAYMENT_STATUS.SUCCEEDED:
			return <Chip variant='success' label='Succeeded' />;
		case PAYMENT_STATUS.FAILED:
			return <Chip variant='failed' label='Failed' />;
		case PAYMENT_STATUS.REFUNDED:
			return <Chip variant='default' label='Refunded' />;
		case PAYMENT_STATUS.PARTIALLY_REFUNDED:
			return <Chip variant='default' label='Partially Refunded' />;
		case PAYMENT_STATUS.OVERPAID:
			return <Chip variant='warning' label='Overpaid' />;
		default:
			return <Chip variant='default' label='Unknown' />;
	}
};

/** Invoice enriched with subscription customer data (client-side only) */
type EnrichedInvoice = Invoice & { subscription_customer?: Customer };

/**
 * Fetch subscription customers for invoices where subscription_customer_id differs from customer_id.
 * Returns a map of customer_id -> Customer.
 */
async function fetchSubscriptionCustomers(invoices: Invoice[]): Promise<Map<string, Customer>> {
	const subCustIds = new Set<string>();
	for (const inv of invoices) {
		if (inv.subscription_customer_id && inv.subscription_customer_id !== inv.customer_id) {
			subCustIds.add(inv.subscription_customer_id);
		}
	}
	if (subCustIds.size === 0) return new Map();

	try {
		const ids = [...subCustIds];
		const res = await CustomerApi.getCustomersByFilters({
			customer_ids: ids,
			limit: ids.length,
			offset: 0,
			filters: [],
			sort: [],
			status: ENTITY_STATUS.PUBLISHED,
		});
		const map = new Map<string, Customer>();
		for (const c of res.items ?? []) {
			map.set(c.id, c);
		}
		return map;
	} catch {
		return new Map();
	}
}

function invoiceHasDistinctSubscriptionCustomer(inv: Invoice): boolean {
	return Boolean(inv.subscription_customer_id && inv.subscription_customer_id !== inv.customer_id);
}

const InvoicesPage = () => {
	const navigate = useNavigate();
	const [showSubscriptionCustomerColumn, setShowSubscriptionCustomerColumn] = useState(false);

	const onInvoicesDataChange = useCallback((d: { items: EnrichedInvoice[]; pagination: { total?: number } } | undefined) => {
		const items = d?.items ?? [];
		setShowSubscriptionCustomerColumn(items.some(invoiceHasDistinctSubscriptionCustomer));
	}, []);

	const enrichedFetchFn = useCallback(async (params: any) => {
		const result = await InvoiceApi.listInvoices(params);
		const rawItems = result.items ?? [];
		const hasMismatchOnPage = rawItems.some(invoiceHasDistinctSubscriptionCustomer);

		const custMap = hasMismatchOnPage ? await fetchSubscriptionCustomers(rawItems) : new Map<string, Customer>();
		const items: EnrichedInvoice[] = rawItems.map((inv) => {
			if (invoiceHasDistinctSubscriptionCustomer(inv)) {
				return { ...inv, subscription_customer: custMap.get(inv.subscription_customer_id!) };
			}
			return inv;
		});
		return { ...result, items };
	}, []);

	const columns: ColumnData<EnrichedInvoice>[] = useMemo(() => {
		const subscriptionCustomerColumn: ColumnData<EnrichedInvoice> = {
			title: 'Subscription Customer',
			render: (row: EnrichedInvoice) => {
				if (!invoiceHasDistinctSubscriptionCustomer(row)) {
					return '--';
				}
				const subCust = row.subscription_customer;
				if (!subCust?.name || !subCust?.id) {
					return '--';
				}
				return <RedirectCell redirectUrl={`${RouteNames.customers}/${subCust.id}`}>{subCust.name}</RedirectCell>;
			},
		};

		return [
			{
				title: 'Invoice Number',
				render: (row: EnrichedInvoice) =>
					row.invoice_status?.toUpperCase() === INVOICE_STATUS.DRAFT && !row.public_reference ? (
						<span className='text-gray-400 italic text-[13px]'>To be generated</span>
					) : (
						<span>{invoiceReference(row)}</span>
					),
			},
			{
				title: 'Amount',
				render: (row) => <span>{`${getCurrencySymbol(row.currency)}${row.amount_due}`}</span>,
			},
			{
				title: 'Invoice Status',
				render: (row: EnrichedInvoice) => getStatusChip(row.invoice_status),
			},
			{
				title: 'Billing Entity',
				render: (row: EnrichedInvoice) => {
					if (!row.customer?.name || !row.customer?.id) {
						return '--';
					}
					return <RedirectCell redirectUrl={`${RouteNames.customers}/${row.customer.id}`}>{row.customer.name}</RedirectCell>;
				},
			},
			...(showSubscriptionCustomerColumn ? [subscriptionCustomerColumn] : []),
			{
				title: 'Payment Status',
				render: (row: EnrichedInvoice) => getPaymentStatusChip(row.payment_status),
			},
			{
				title: 'Due Date',
				render: (row: EnrichedInvoice) => <span>{row.due_date ? formatDateShort(row.due_date) : '--'}</span>,
			},
			{
				fieldVariant: 'interactive',
				hideOnEmpty: true,
				render: (row: EnrichedInvoice) => {
					return <InvoiceTableMenu data={row} />;
				},
			},
		];
	}, [showSubscriptionCustomerColumn]);

	return (
		<Page heading='Invoices'>
			<ApiDocsContent tags={['Invoices']} />
			<QueryableDataArea<EnrichedInvoice>
				queryConfig={{
					filterOptions,
					sortOptions: sortingOptions,
					initialFilters,
					initialSorts,
					debounceTime: 300,
				}}
				dataConfig={{
					queryKey: 'fetchInvoices',
					fetchFn: enrichedFetchFn,
					onMainDataChange: onInvoicesDataChange,
					probeFetchFn: async (params) =>
						InvoiceApi.listInvoices({
							...params,
							limit: 1,
							offset: 0,
							filters: [],
							sort: [],
						}),
				}}
				tableConfig={{
					columns,
					onRowClick: (row) => {
						navigate(`/billing/invoices/${row.id}`);
					},
					showEmptyRow: true,
				}}
				paginationConfig={{
					unit: 'Invoices',
				}}
				emptyStateConfig={{
					heading: 'Invoices',
					description: 'Generate an invoice to initiate billing and manage customer payments.',
					tags: ['Invoices'],
					tutorials: GUIDES.invoices.tutorials,
				}}
			/>
		</Page>
	);
};

export default InvoicesPage;
