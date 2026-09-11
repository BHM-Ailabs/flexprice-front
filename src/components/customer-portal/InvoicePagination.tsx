import { PORTAL_INVOICE_PAGE_SIZE } from './usePortalInvoices';

export default function InvoicePagination({
	page,
	total,
	busy,
	onPage,
}: {
	page: number;
	total: number;
	busy: boolean;
	onPage: (page: number) => void;
}) {
	return (
		<nav aria-label='Invoice pages' className='flex items-center justify-between gap-3 text-sm'>
			<button
				type='button'
				className='rounded border px-3 py-2 disabled:opacity-50'
				disabled={busy || page <= 1}
				onClick={() => onPage(page - 1)}>
				Previous invoices
			</button>
			<span aria-live='polite'>
				Page {page} · {total} invoices
			</span>
			<button
				type='button'
				className='rounded border px-3 py-2 disabled:opacity-50'
				disabled={busy || page * PORTAL_INVOICE_PAGE_SIZE >= total}
				onClick={() => onPage(page + 1)}>
				Next invoices
			</button>
		</nav>
	);
}
