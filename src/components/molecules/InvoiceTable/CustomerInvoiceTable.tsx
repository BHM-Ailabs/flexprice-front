import { invoiceReference } from '@/utils/invoices/invoiceReference';
import { FC, useMemo } from 'react';
import FlexpriceTable, { ColumnData, RedirectCell } from '../Table';
import { getCurrencySymbol } from '@/utils/common/helper_functions';
import { formatBillingPeriod } from '@/utils/common/format_date';
import { Invoice, INVOICE_TYPE } from '@/models/Invoice';
import { getPaymentStatusChip, getStatusChip } from './InvoiceTable';
import Customer from '@/models/Customer';
import { RouteNames } from '@/core/routes/Routes';

const getPlanDisplayName = (invoice: Invoice): string => {
	if (invoice.invoice_type !== INVOICE_TYPE.SUBSCRIPTION) return '--';
	return invoice.line_items?.find((item) => item.plan_display_name)?.plan_display_name ?? '--';
};

import InvoiceTableMenu from './InvoiceTableMenu';

/** Invoice enriched with subscription customer data */
export type EnrichedInvoice = Invoice & { subscription_customer?: Customer };

interface Props {
	data: EnrichedInvoice[];
	customerId?: string;
	onRowClick?: (row: Invoice) => void;
}

const CustomerInvoiceTable: FC<Props> = ({ data, onRowClick }) => {
	// Only show Subscription Customer column if at least one invoice has a different subscription_customer_id
	const hasSubscriptionCustomer = useMemo(
		() => data.some((inv) => inv.subscription_customer_id && inv.subscription_customer_id !== inv.customer_id),
		[data],
	);

	const columnData: ColumnData<EnrichedInvoice>[] = useMemo(() => {
		const cols: ColumnData<EnrichedInvoice>[] = [
			{
				title: 'Invoice Number',
				render: (row) => <>{invoiceReference(row)}</>,
			},
			{
				title: 'Plan',
				render: (row) => <>{getPlanDisplayName(row)}</>,
			},
			{
				title: 'Status',
				render: (row: EnrichedInvoice) => getStatusChip(row.invoice_status),
			},
			{
				title: 'Payment Status',
				render: (row: EnrichedInvoice) => getPaymentStatusChip(row.payment_status),
			},
		];

		if (hasSubscriptionCustomer) {
			cols.push({
				title: 'Subscription Customer',
				render: (row: EnrichedInvoice) => {
					if (!row.subscription_customer_id || row.subscription_customer_id === row.customer_id) {
						return <>--</>;
					}
					const subCust = row.subscription_customer;
					if (!subCust?.name || !subCust?.id) {
						return <>--</>;
					}
					return <RedirectCell redirectUrl={`${RouteNames.customers}/${subCust.id}`}>{subCust.name}</RedirectCell>;
				},
			});
		}

		cols.push(
			{
				title: 'Billing Period',
				render: (row) => <>{row.period_start && row.period_end ? formatBillingPeriod(row.period_start, row.period_end) : '--'}</>,
			},
			{
				title: 'Total',
				render: (row) => <>{`${getCurrencySymbol(row.currency)} ${row.total}`}</>,
			},
			{
				title: 'Amount Due',
				render: (row) => <>{`${getCurrencySymbol(row.currency)} ${row.amount_due}`}</>,
			},
			{
				fieldVariant: 'interactive',
				hideOnEmpty: true,
				render: (row) => <InvoiceTableMenu data={row} />,
			},
		);

		return cols;
	}, [hasSubscriptionCustomer]);

	return (
		<div>
			<FlexpriceTable showEmptyRow onRowClick={onRowClick} columns={columnData} data={data ?? []} />
		</div>
	);
};

export default CustomerInvoiceTable;
