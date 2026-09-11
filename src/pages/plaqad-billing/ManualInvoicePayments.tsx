import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Dialog } from '@/components/atoms';
import { billingPost, type ExternalInvoicePayment, type PrepaidInvoiceDetail } from '@/api/PlaqadBillingApi';
import { ErrorNotice, Field, date, fieldClass, tableClass } from './shared';
import { invoiceMoney, parseAmountMinor } from './invoices';

export default function ManualInvoicePayments({ detail, refresh }: { detail: PrepaidInvoiceDetail; refresh: () => void }) {
	const { invoice } = detail;
	const records = detail.externalPayments ?? [];
	const remaining = detail.amountRemainingMinor ?? invoice.amountMinor;
	const pending = records.find((row) => !row.confirmedAt);
	const [open, setOpen] = useState(false);
	const [reference, setReference] = useState('');
	const [amount, setAmount] = useState('');
	const [method, setMethod] = useState<ExternalInvoicePayment['method']>('bank_transfer');
	const [receivedAt, setReceivedAt] = useState('');
	const [confirmed, setConfirmed] = useState(false);
	const [recorded, setRecorded] = useState(false);
	const canRecord =
		invoice.collectionMethod === 'manual' &&
		Boolean(invoice.workspaceId && invoice.providerInvoiceId) &&
		['claimed', 'payment_pending', 'paid'].includes(invoice.status) &&
		(remaining > 0 || Boolean(pending));
	const mutation = useMutation({
		mutationFn: async () => {
			if (!confirmed || !canRecord) throw new Error('Confirm an actual received payment for a linked manual invoice.');
			const amountMinor = parseAmountMinor(amount);
			if (!pending && amountMinor > remaining) throw new Error('The received amount exceeds the invoice outstanding balance.');
			const received = new Date(receivedAt);
			if (!reference.trim()) throw new Error('Enter the bank or receipt reference.');
			if (!Number.isFinite(received.valueOf()) || received.valueOf() > Date.now())
				throw new Error('Enter the actual received date, which cannot be in the future.');
			return billingPost(`/invoices/${encodeURIComponent(invoice.id)}/record-payment`, {
				reference: reference.trim(),
				amountMinor,
				currency: invoice.currency,
				method,
				receivedAt: pending?.receivedAt ?? received.toISOString(),
			});
		},
		onSuccess: () => {
			setOpen(false);
			setRecorded(true);
			refresh();
		},
	});
	function begin() {
		setReference(pending?.reference ?? '');
		setAmount(pending ? (pending.amountMinor / 100).toFixed(2) : '');
		setMethod(pending?.method ?? 'bank_transfer');
		const at = new Date(pending?.receivedAt ?? Date.now());
		setReceivedAt(new Date(at.valueOf() - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
		setConfirmed(false);
		mutation.reset();
		setOpen(true);
	}
	function submit(event: FormEvent) {
		event.preventDefault();
		mutation.mutate();
	}
	return (
		<div className='mt-6 space-y-4 rounded-md border border-zinc-200 p-4'>
			<h3 className='font-medium'>Manual payment instructions</h3>
			<p className='whitespace-pre-wrap text-sm'>{invoice.manualPaymentInstructions || 'No instructions provided.'}</p>
			<p className='text-sm'>
				{invoiceMoney(detail.amountPaidMinor ?? 0, invoice.currency)} confirmed · {invoiceMoney(remaining, invoice.currency)} outstanding
			</p>
			<p className='text-xs text-zinc-500'>
				Record money already received using a unique bank or receipt reference. Credit or plan activation follows full confirmed settlement.
				New recipients must sign up and link their account first.
			</p>
			{recorded && (
				<p role='status' className='text-sm'>
					Payment evidence recorded. Refreshing the invoice balance.
				</p>
			)}
			{records.length > 0 && (
				<div className='overflow-x-auto'>
					<table className={tableClass}>
						<thead>
							<tr>
								<th>Reference</th>
								<th>Received</th>
								<th>Amount</th>
								<th>Method</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{records.map((row) => (
								<tr key={row.id}>
									<td>{row.reference}</td>
									<td>{date(row.receivedAt)}</td>
									<td>{invoiceMoney(row.amountMinor, row.currency)}</td>
									<td>{row.method.replace('_', ' ')}</td>
									<td>{row.confirmedAt ? 'Confirmed' : 'Pending reconciliation'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{canRecord ? (
				<Button variant='outline' onClick={begin}>
					{pending ? 'Reconcile pending payment' : 'Record received payment'}
				</Button>
			) : !invoice.workspaceId || !invoice.providerInvoiceId ? (
				<p className='text-sm text-zinc-500'>Link the verified customer workspace and prepare the invoice before recording a payment.</p>
			) : null}
			<Dialog
				isOpen={open}
				onOpenChange={(next) => {
					if (!mutation.isPending) setOpen(next);
				}}
				title={pending ? 'Reconcile received payment' : 'Record received payment'}
				description='This records actual money received outside the gateway. It does not initiate a charge or send an email.'>
				<form onSubmit={submit} className='space-y-4'>
					<p className='text-sm font-medium'>
						{invoice.invoiceNumber} · {invoice.recipientEmail} · {invoiceMoney(remaining, invoice.currency)} outstanding
					</p>
					{pending && (
						<p className='text-sm'>
							Retrying the existing immutable evidence and provider reference. No duplicate payment will be created.
						</p>
					)}
					<Field label='Bank or receipt reference'>
						<input
							required
							maxLength={200}
							className={fieldClass}
							readOnly={Boolean(pending)}
							value={reference}
							onChange={(e) => setReference(e.target.value)}
						/>
					</Field>
					<Field label={`Amount received (${invoice.currency})`}>
						<input
							required
							inputMode='decimal'
							className={fieldClass}
							readOnly={Boolean(pending)}
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
						/>
					</Field>
					<Field label='Payment method'>
						<select
							className={fieldClass}
							disabled={Boolean(pending)}
							value={method}
							onChange={(e) => setMethod(e.target.value as ExternalInvoicePayment['method'])}>
							<option value='bank_transfer'>Bank transfer</option>
							<option value='cash'>Cash</option>
							<option value='cheque'>Cheque</option>
							<option value='other'>Other</option>
						</select>
					</Field>
					<Field label='Date money was received'>
						<input
							required
							type='datetime-local'
							className={fieldClass}
							readOnly={Boolean(pending)}
							value={receivedAt}
							onChange={(e) => setReceivedAt(e.target.value)}
						/>
					</Field>
					<label className='flex items-start gap-2 text-sm'>
						<input type='checkbox' checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I verified that this money was
						received for this customer and invoice.
					</label>
					<ErrorNotice error={mutation.error} />
					<div className='flex justify-end gap-2'>
						<Button type='button' variant='outline' disabled={mutation.isPending} onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type='submit' variant='black' disabled={!confirmed} isLoading={mutation.isPending}>
							{pending ? 'Reconcile this payment' : 'Record this payment'}
						</Button>
					</div>
				</form>
			</Dialog>
		</div>
	);
}
