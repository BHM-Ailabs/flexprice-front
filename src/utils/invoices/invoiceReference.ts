import { DataType, FilterOperator, type FilterCondition } from '@/types/common/QueryBuilder';
import { getFiltersParamKey, serializeFilters } from '@/utils/filterPersistence';

type NativeInvoiceReference = {
	public_reference?: string | null;
	invoice_number?: string | null;
};
type AccountInvoiceReference = {
	publicReference?: string | null;
	invoiceNumber?: string | null;
};

/** Explicitly unresolved references stay pending; older APIs and other tenants retain their original number. */
export function invoiceReference(invoice?: NativeInvoiceReference | null): string {
	if (!invoice) return 'Number pending';
	if (Object.prototype.hasOwnProperty.call(invoice, 'public_reference')) return invoice.public_reference?.trim() || 'Number pending';
	return invoice.invoice_number?.trim() || 'Number pending';
}

export function prepaidInvoiceReference(invoice: AccountInvoiceReference): string {
	if (Object.prototype.hasOwnProperty.call(invoice, 'publicReference')) return invoice.publicReference?.trim() || 'Number pending';
	return invoice.invoiceNumber?.trim() || 'Number pending';
}

/** Preserve internal IDs in navigation; search is an alias-aware server filter, never a guessed invoice ID. */
export function invoiceSearchHref(search: string): string {
	const filters: FilterCondition[] = search.trim()
		? [
				{
					field: 'invoice_reference',
					operator: FilterOperator.CONTAINS,
					valueString: search.trim().slice(0, 200),
					dataType: DataType.STRING,
					id: 'initial-invoice-number',
				},
			]
		: [];
	const params = new URLSearchParams({ [getFiltersParamKey('fetchInvoices')]: serializeFilters(filters) });
	return `/billing/invoices?${params}`;
}
