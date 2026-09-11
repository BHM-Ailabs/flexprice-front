import { invoiceReference } from '@/utils/invoices/invoiceReference';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CustomerPortalApi from '@/api/CustomerPortalApi';
import { usePortalInvoices } from '@/components/customer-portal/usePortalInvoices';
import InvoicePagination from '@/components/customer-portal/InvoicePagination';
import { Card, Chip } from '@/components/atoms';
import { InvoiceDownloadFormatDialog } from '@/components/molecules';
import { Invoice, INVOICE_STATUS } from '@/models/Invoice';
import { PAYMENT_STATUS } from '@/constants/payment';
import { formatDateShort, getCurrencySymbol } from '@/utils/common/helper_functions';
import { formatAmount } from '@/components/atoms/Input/Input';
import { Download, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui';
import EmptyState from './EmptyState';
import { downloadInvoiceLineItemsCsv } from '@/utils/invoices/downloadInvoiceLineItemsCsv';

const getStatusChip = (invoice: Invoice) => {
	// Check payment status first
	if (invoice.payment_status === PAYMENT_STATUS.SUCCEEDED) {
		return <Chip label='Paid' variant='success' />;
	}

	if (invoice.invoice_status === INVOICE_STATUS.VOIDED) {
		return <Chip label='Voided' variant='default' />;
	}

	if (invoice.invoice_status === INVOICE_STATUS.DRAFT) {
		return <Chip label='Draft' variant='default' />;
	}

	// Check if overdue (we already know payment is not SUCCEEDED at this point)
	const isOverdue = new Date(invoice.due_date) < new Date();
	if (isOverdue) {
		return <Chip label='Overdue' variant='failed' />;
	}

	return <Chip label='Pending' variant='warning' />;
};

const InvoicesTab = () => {
	const invoiceSearch = usePortalInvoices();
	const { search: searchQuery, setSearch: setSearchQuery, data: invoicesData, isLoading, isError } = invoiceSearch;
	const [downloadTarget, setDownloadTarget] = useState<Invoice | null>(null);
	const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
	const [isCsvExportPending, setIsCsvExportPending] = useState(false);

	const { mutateAsync: downloadPortalPdfAsync, isPending: isPdfDownloadPending } = useMutation({
		mutationFn: (invoiceId: string) => CustomerPortalApi.downloadInvoicePdf(invoiceId, invoiceReference(downloadTarget)),
		onSuccess: () => {
			toast.success('Invoice downloaded');
		},
		onError: () => {
			toast.error('Failed to download invoice');
		},
	});

	const invoices = invoicesData?.items ?? [];

	const openInvoiceDownload = (invoice: Invoice) => {
		setDownloadTarget(invoice);
		setIsDownloadDialogOpen(true);
	};

	const busyDownloadInvoiceId = isPdfDownloadPending || isCsvExportPending ? (downloadTarget?.id ?? null) : null;

	return (
		<div className='space-y-6'>
			<InvoiceDownloadFormatDialog
				open={isDownloadDialogOpen}
				onOpenChange={(open) => {
					setIsDownloadDialogOpen(open);
					if (!open) {
						setDownloadTarget(null);
					}
				}}
				isPdfPending={isPdfDownloadPending}
				isCsvPending={isCsvExportPending}
				onSelectPdf={async () => {
					if (!downloadTarget) return;
					await downloadPortalPdfAsync(downloadTarget.id);
				}}
				onSelectCsv={async () => {
					if (!downloadTarget) return;
					setIsCsvExportPending(true);
					try {
						const full = downloadTarget.line_items?.length ? downloadTarget : await CustomerPortalApi.getInvoice(downloadTarget.id);
						const rows = downloadInvoiceLineItemsCsv(full);
						if (rows === 0) {
							toast.error('No billable line items to export');
						} else {
							toast.success('Invoice CSV downloaded');
						}
					} catch {
						toast.error('Failed to export invoice');
					} finally {
						setIsCsvExportPending(false);
					}
				}}
			/>
			{/* Search */}
			<div className='relative'>
				<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400' />
				<Input
					aria-label='Search invoices'
					maxLength={200}
					placeholder='Search invoice number or reference'
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className='pl-10 bg-white border-[#E9E9E9]'
				/>
			</div>

			{/* Invoices Table */}
			<Card className='bg-white border border-[#E9E9E9] rounded-xl overflow-hidden'>
				<div className='overflow-x-auto'>
					<table className='w-full'>
						<thead>
							<tr className='border-b border-[#E9E9E9] bg-zinc-50'>
								<th className='text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Date</th>
								<th className='text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Invoice #</th>
								<th className='text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Status</th>
								<th className='text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Amount</th>
								<th className='text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider'>Download</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-[#E9E9E9]'>
							{invoices.map((invoice) => (
								<tr key={invoice.id} className='hover:bg-zinc-50 transition-colors'>
									<td className='px-4 py-3 text-sm text-zinc-700'>
										{invoice.finalized_at ? formatDateShort(invoice.finalized_at) : formatDateShort(invoice.created_at)}
									</td>
									<td className='px-4 py-3 text-sm text-zinc-900 font-medium'>{invoiceReference(invoice)}</td>
									<td className='px-4 py-3'>{getStatusChip(invoice)}</td>
									<td className='px-4 py-3 text-sm text-zinc-900 text-right font-medium'>
										{getCurrencySymbol(invoice.currency)}
										{formatAmount(String(invoice.total ?? 0))}
									</td>
									<td className='px-4 py-3 text-center'>
										{invoice.invoice_status === INVOICE_STATUS.FINALIZED && (
											<button
												onClick={() => openInvoiceDownload(invoice)}
												disabled={busyDownloadInvoiceId !== null}
												className='p-2 hover:bg-zinc-100 rounded-md transition-colors text-zinc-500 hover:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed'>
												{busyDownloadInvoiceId === invoice.id ? (
													<Loader2 className='h-4 w-4 animate-spin' />
												) : (
													<Download className='h-4 w-4' />
												)}
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{!isLoading && !isError && invoices.length === 0 && (
					<div className='py-8'>
						<EmptyState title='No invoices found' description='No invoices match your search criteria' />
					</div>
				)}
			</Card>
			{isLoading && <p role='status'>Loading invoices…</p>}
			{isError && (
				<p role='alert'>
					Invoices could not be loaded.{' '}
					<button type='button' className='underline' onClick={() => void invoiceSearch.refetch()}>
						Retry
					</button>
				</p>
			)}
			<InvoicePagination
				page={invoiceSearch.page}
				total={invoiceSearch.total}
				busy={invoiceSearch.isFetching}
				onPage={invoiceSearch.setPage}
			/>
		</div>
	);
};

export default InvoicesTab;
