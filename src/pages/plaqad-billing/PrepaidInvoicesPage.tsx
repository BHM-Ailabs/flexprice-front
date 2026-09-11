import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog } from '@/components/atoms';
import {
	billingGet,
	billingPost,
	downloadInvoice,
	invoicePlans,
	type InvoiceCreate,
	type PrepaidInvoice,
	type PrepaidInvoiceDetail,
} from '@/api/PlaqadBillingApi';
import { BillingPage, ErrorNotice, Field, Panel, date, fieldClass, number, tableClass } from './shared';
import { invoiceMoney, parseAmountMinor, paymentLink, reviewRecipients } from './invoices';
import InvoiceDocumentProfile from './InvoiceDocumentProfile';
import ManualInvoicePayments from './ManualInvoicePayments';

const statusLabels: Record<PrepaidInvoice['status'], string> = {
	draft: 'Draft',
	issued: 'Issued',
	claimed: 'Account linked',
	payment_pending: 'Awaiting payment',
	paid: 'Paid · activation pending',
	fulfilled: 'Paid and activated',
	revoked: 'Revoked',
};
export default function PrepaidInvoicesPage() {
	const client = useQueryClient();
	const navigate = useNavigate();
	const { invoiceId } = useParams<{ invoiceId: string }>();
	const list = useQuery({
		queryKey: ['plaqad-invoices'],
		queryFn: () => billingGet<{ invoices: PrepaidInvoice[] }>('/invoices'),
		refetchInterval: 60000,
	});
	const selected = invoiceId ?? null;
	const selectInvoice = (id: string) => navigate(`/billing/prepaid-invoices/${encodeURIComponent(id)}`);
	const detail = useQuery({
		queryKey: ['plaqad-invoice', selected],
		queryFn: () => billingGet<PrepaidInvoiceDetail>(`/invoices/${encodeURIComponent(selected!)}`),
		enabled: !!selected,
		refetchInterval: 60000,
	});
	const [creating, setCreating] = useState(false);
	const [createKey, setCreateKey] = useState(() => crypto.randomUUID());
	const [recipientEmail, setRecipientEmail] = useState('');
	const [recipientName, setRecipientName] = useState('');
	const [recipientAddress, setRecipientAddress] = useState('');
	const [recipientTaxId, setRecipientTaxId] = useState('');
	const [collectionMethod, setCollectionMethod] = useState<'gateway' | 'manual'>('gateway');
	const [manualInstructions, setManualInstructions] = useState('');
	const [kind, setKind] = useState<'credits' | 'plan'>('credits');
	const [credits, setCredits] = useState('25000');
	const [currency, setCurrency] = useState('NGN');
	const [customAmount, setCustomAmount] = useState(false);
	const [amount, setAmount] = useState('');
	const [plan, setPlan] = useState('');
	const [dueAt, setDueAt] = useState('');
	const [note, setNote] = useState('');
	const [intel, setIntel] = useState(false);
	const [intelPlan, setIntelPlan] = useState('');
	const [search, setSearch] = useState('');
	const [error, setError] = useState<unknown>(null);
	const [notice, setNotice] = useState('');
	const [delivery, setDelivery] = useState<'review' | 'recipient' | 'revoke' | 'issue' | 'prepare' | null>(null);
	const [workspaceId, setWorkspaceId] = useState('');
	const [reviewEmails, setReviewEmails] = useState('');
	const [acknowledged, setAcknowledged] = useState(false);
	const [sendingError, setSendingError] = useState<unknown>(null);
	const [downloading, setDownloading] = useState(false);
	const invoice = detail.data?.invoice;
	const checkoutUrl = paymentLink(detail.data?.checkoutUrl ?? invoice?.checkoutUrl);
	const plans = useQuery({ queryKey: ['plaqad-invoice-plans'], queryFn: invoicePlans, enabled: creating && kind === 'plan' });
	const rows =
		list.data?.invoices.filter((row) =>
			`${row.invoiceNumber} ${row.recipientName || ''} ${row.recipientEmail}`.toLowerCase().includes(search.toLowerCase()),
		) ?? [];

	function invalidate() {
		void client.invalidateQueries({ queryKey: ['plaqad-invoices'] });
		void client.invalidateQueries({ queryKey: ['plaqad-invoice'] });
	}
	const create = useMutation({
		mutationFn: async () => {
			const due = new Date(dueAt);
			if (!Number.isFinite(due.valueOf()) || due.valueOf() <= Date.now() || due.valueOf() > Date.now() + 90 * 86400000)
				throw new Error('Choose a due date within the next 90 days.');
			const payload: InvoiceCreate = {
				idempotencyKey: createKey,
				recipientEmail: recipientEmail.trim(),
				recipientName: recipientName.trim() || undefined,
				recipientAddress: recipientAddress.trim() || undefined,
				recipientTaxId: recipientTaxId.trim() || undefined,
				collectionMethod,
				kind,
				currency,
				dueAt: due.toISOString(),
				note: note.trim() || undefined,
			};
			if (collectionMethod === 'manual') {
				if (!manualInstructions.trim()) throw new Error('Enter the verified manual payment instructions.');
				payload.manualPaymentInstructions = manualInstructions.trim();
			}
			if (kind === 'credits') {
				const count = Number(credits);
				if (!Number.isSafeInteger(count) || count < 500 || count > 100000 || count % 100 !== 0)
					throw new Error('Enter 500 to 100,000 credits, in steps of 100.');
				payload.credits = count;
				if (customAmount) payload.amountMinor = parseAmountMinor(amount);
			} else {
				if (!plan.trim()) throw new Error('Choose a plan lookup key.');
				payload.planLookupKey = plan.trim();
			}
			if (kind === 'credits' && intel) {
				if (!intelPlan.trim()) throw new Error('Enter the Intel promotional plan lookup key.');
				payload.intelPromotion = { planLookupKey: intelPlan.trim(), days: 14 };
			}
			return billingPost<{ invoice: PrepaidInvoice; claimUrl: string }>('/invoices', payload);
		},
		onSuccess: (result) => {
			selectInvoice(result.invoice.id);
			setCreating(false);
			setCreateKey(crypto.randomUUID());
			setNotice(`Invoice ${result.invoice.invoiceNumber} saved as a draft. No email has been sent.`);
			invalidate();
		},
		onError: setError,
	});
	const send = useMutation({
		mutationFn: async () => {
			if (!invoice || !delivery) throw new Error('Select an invoice first.');
			if (delivery === 'prepare') {
				if (!workspaceId.trim()) throw new Error('Enter the customer workspace ID.');
				return billingPost<PrepaidInvoiceDetail>(`/invoices/${encodeURIComponent(invoice.id)}/prepare-payment`, {
					workspaceId: workspaceId.trim(),
				});
			}
			if (delivery === 'revoke' || delivery === 'issue') return billingPost(`/invoices/${invoice.id}/${delivery}`, {});
			const payload =
				delivery === 'review'
					? { audience: 'review', reviewEmails: reviewRecipients(reviewEmails, invoice.recipientEmail) }
					: { audience: 'recipient' };
			return billingPost(`/invoices/${invoice.id}/send`, payload);
		},
		onSuccess: () => {
			setNotice(
				delivery === 'revoke'
					? 'Invoice revoked.'
					: delivery === 'issue'
						? 'Invoice issued. No email has been sent.'
						: delivery === 'prepare'
							? invoice?.collectionMethod === 'manual'
								? 'Manual invoice prepared for the verified account. No email has been sent.'
								: 'Payment link prepared. The customer has not been emailed.'
							: delivery === 'review'
								? 'Review copy sent. The customer has not been emailed.'
								: `Invoice sent to ${invoice?.recipientEmail}.`,
			);
			setDelivery(null);
			invalidate();
		},
		onError: setSendingError,
	});
	function submit(event: FormEvent) {
		event.preventDefault();
		setError(null);
		create.mutate();
	}
	function openDelivery(kind: 'review' | 'recipient' | 'revoke' | 'issue' | 'prepare') {
		setDelivery(kind);
		if (kind === 'prepare') setWorkspaceId(invoice?.workspaceId ?? '');
		setAcknowledged(false);
		setSendingError(null);
	}
	async function pdf() {
		if (!invoice) return;
		setDownloading(true);
		try {
			await downloadInvoice(invoice.id);
		} catch (cause) {
			setError(cause);
		} finally {
			setDownloading(false);
		}
	}

	return (
		<BillingPage
			title='Prepaid invoices'
			description='Prepare credit top-ups or plan invoices for an email address. Collect through hosted checkout or record verified manual payments against the customer’s Plaqad account.'>
			<ErrorNotice
				error={list.error || detail.error || (!creating ? error : null)}
				retry={() => {
					void list.refetch();
					if (selected) void detail.refetch();
				}}
			/>
			{notice && (
				<p role='status' className='mb-5 rounded-md bg-zinc-100 p-4 text-sm'>
					{notice}
				</p>
			)}
			<div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
				<div className='w-full sm:max-w-sm'>
					<Field label='Find an invoice'>
						<input
							type='search'
							className={fieldClass}
							placeholder='Invoice number, name or email'
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</Field>
				</div>
				<InvoiceDocumentProfile />
				<Button
					variant='black'
					onClick={() => {
						setCreating(true);
						setError(null);
					}}>
					Create invoice draft
				</Button>
			</div>
			{list.isLoading ? (
				<p role='status'>Loading invoices…</p>
			) : (
				<Panel title='Recent prepaid invoices'>
					<div className='overflow-x-auto'>
						<table className={`${tableClass} min-w-[760px]`}>
							<thead>
								<tr>
									<th>Invoice</th>
									<th>Customer</th>
									<th>Purchase</th>
									<th>Amount</th>
									<th>Status</th>
									<th>Due</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr key={row.id} className={selected === row.id ? 'bg-zinc-50' : ''}>
										<td>
											<button
												type='button'
												className='font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2'
												onClick={() => {
													selectInvoice(row.id);
													setError(null);
												}}>
												{row.invoiceNumber}
											</button>
										</td>
										<td>
											<span className='block'>{row.recipientName}</span>
											<span className='text-xs text-zinc-500'>{row.recipientEmail}</span>
										</td>
										<td>{row.kind === 'credits' ? `${number(row.credits ?? 0)} credits` : row.planName || row.planLookupKey}</td>
										<td className='whitespace-nowrap tabular-nums'>{invoiceMoney(row.amountMinor, row.currency)}</td>
										<td className='whitespace-nowrap'>{statusLabels[row.status] || row.status}</td>
										<td className='whitespace-nowrap text-xs'>{date(row.dueAt)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{rows.length === 0 && (
						<p className='py-10 text-center text-sm text-zinc-500'>
							No invoices found. Create a draft to prepare your first prepaid invoice.
						</p>
					)}
				</Panel>
			)}
			{detail.isFetching && (
				<p role='status' className='my-4 text-sm'>
					Loading invoice details…
				</p>
			)}
			{invoice && (
				<Panel title={`${invoice.invoiceNumber} · ${statusLabels[invoice.status]}`}>
					<div className='grid gap-6 sm:grid-cols-2'>
						<div>
							<p className='text-xs text-zinc-500'>Bill to</p>
							<p className='mt-1 font-medium'>{invoice.recipientName || invoice.recipientEmail}</p>
							<p className='text-sm text-zinc-600'>{invoice.recipientEmail}</p>
							{invoice.recipientAddress && <p className='whitespace-pre-wrap text-sm'>{invoice.recipientAddress}</p>}
							{invoice.recipientTaxId && <p className='text-sm'>Tax ID: {invoice.recipientTaxId}</p>}
							<p className='mt-4 text-sm text-zinc-500'>Due {date(invoice.dueAt)}</p>
						</div>
						<div className='sm:text-right'>
							<p className='text-xs text-zinc-500'>Invoice total</p>
							<p className='mt-1 text-3xl font-medium tabular-nums'>{invoiceMoney(invoice.amountMinor, invoice.currency)}</p>
							<p className='mt-2 text-sm'>
								{invoice.kind === 'credits' ? `${number(invoice.credits ?? 0)} prepaid credits` : invoice.planName || invoice.planLookupKey}
							</p>
						</div>
					</div>
					{invoice.intelPromotion && (
						<div className='mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6'>
							<p className='font-medium'>Complimentary Intel access · 14 days after payment</p>
							<p>
								The credit purchase excludes Intel. Before the promotion ends, the customer is asked whether to continue on pay-as-you-go.
								Without agreement, Intel is disabled when the promotion expires.
							</p>
						</div>
					)}
					{invoice.note && <p className='mt-5 whitespace-pre-wrap text-sm text-zinc-600'>{invoice.note}</p>}
					{invoice.workspaceId && <p className='mt-4 text-xs text-zinc-500'>Customer workspace: {invoice.workspaceId}</p>}
					{detail.data?.claimUrl?.startsWith('https://account.plaqad.com/') && (
						<p className='mt-4 text-sm'>
							<a href={detail.data.claimUrl} target='_blank' rel='noopener noreferrer' className='underline'>
								Customer account and invoice link
							</a>
						</p>
					)}
					{invoice.collectionMethod === 'manual' && detail.data && (
						<ManualInvoicePayments key={invoice.id} detail={detail.data} refresh={invalidate} />
					)}
					{checkoutUrl && (
						<div className='mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4'>
							<p className='mb-2 text-sm font-medium'>Customer payment link</p>
							<a href={checkoutUrl} target='_blank' rel='noopener noreferrer' className='break-all text-sm underline underline-offset-4'>
								{checkoutUrl}
							</a>
							<div className='mt-3'>
								<Button
									variant='outline'
									onClick={() => {
										void navigator.clipboard
											.writeText(checkoutUrl)
											.then(() => setNotice('Payment link copied.'))
											.catch(setError);
									}}>
									Copy payment link
								</Button>
							</div>
						</div>
					)}
					{invoice.providerInvoiceId && (
						<p className='mt-4 text-sm'>
							<Link to={`/billing/invoices/${encodeURIComponent(invoice.providerInvoiceId)}`} className='underline underline-offset-4'>
								View billing provider invoice
							</Link>
						</p>
					)}
					<div className='mt-6 flex flex-wrap gap-2'>
						<Button variant='outline' isLoading={downloading} onClick={() => void pdf()}>
							Download PDF
						</Button>
						{invoice.status !== 'revoked' && (
							<Button variant='outline' onClick={() => openDelivery('review')}>
								Send for review
							</Button>
						)}
						{invoice.status === 'draft' && !invoice.expired && (
							<Button variant='black' onClick={() => openDelivery('issue')}>
								Issue invoice
							</Button>
						)}
						{['issued', 'claimed', 'payment_pending'].includes(invoice.status) &&
							!invoice.expired &&
							!checkoutUrl &&
							(invoice.collectionMethod === 'manual'
								? Boolean(invoice.workspaceId) && invoice.status !== 'issued' && !invoice.providerInvoiceId
								: invoice.kind === 'credits') && (
								<Button variant='outline' onClick={() => openDelivery('prepare')}>
									{invoice.collectionMethod === 'manual'
										? 'Prepare manual invoice'
										: invoice.currency === 'NGN'
											? 'Prepare Paystack link'
											: 'Prepare payment link'}
								</Button>
							)}
						{['issued', 'claimed', 'payment_pending'].includes(invoice.status) && !invoice.expired && (
							<Button variant='black' onClick={() => openDelivery('recipient')}>
								Send invoice to customer
							</Button>
						)}
						{['draft', 'issued', 'claimed'].includes(invoice.status) && (
							<Button variant='ghost' onClick={() => openDelivery('revoke')}>
								Revoke invoice
							</Button>
						)}
					</div>
					{invoice.kind === 'plan' && invoice.collectionMethod !== 'manual' && (
						<p className='mt-3 text-xs text-zinc-500'>
							The customer reviews the plan and recurring payment consent from their account invoice link before starting checkout.
						</p>
					)}
					{invoice.collectionMethod === 'manual' && !invoice.workspaceId && (
						<p className='mt-3 text-xs text-zinc-500'>
							The recipient must open the invoice link and claim it with their verified account before staff can prepare or reconcile a
							manual payment.
						</p>
					)}
					{invoice.status === 'draft' && (
						<p className='mt-3 text-xs text-zinc-500'>
							Drafts cannot be paid. Issue the reviewed invoice first, then send it to the customer.
						</p>
					)}
				</Panel>
			)}
			<Dialog
				isOpen={creating}
				onOpenChange={(open) => {
					if (!create.isPending) setCreating(open);
				}}
				title='Create prepaid invoice draft'
				description='Saving a draft does not email the customer or activate access.'
				className='max-w-2xl'>
				<form onSubmit={submit}>
					<div className='grid gap-4 sm:grid-cols-2'>
						<Field label='Customer email'>
							<input
								className={fieldClass}
								type='email'
								required
								maxLength={320}
								value={recipientEmail}
								onChange={(e) => setRecipientEmail(e.target.value)}
							/>
						</Field>
						<Field label='Customer name (optional)'>
							<input className={fieldClass} maxLength={160} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
						</Field>
						<Field label='Customer billing address (optional)'>
							<textarea
								className={fieldClass}
								maxLength={1000}
								value={recipientAddress}
								onChange={(e) => setRecipientAddress(e.target.value)}
							/>
						</Field>
						<Field label='Customer tax ID (optional)'>
							<input className={fieldClass} maxLength={100} value={recipientTaxId} onChange={(e) => setRecipientTaxId(e.target.value)} />
						</Field>
						<Field label='Collection method'>
							<select
								className={fieldClass}
								value={collectionMethod}
								onChange={(e) => setCollectionMethod(e.target.value as 'gateway' | 'manual')}>
								<option value='gateway'>Hosted payment checkout</option>
								<option value='manual'>Manual payment</option>
							</select>
						</Field>
						{collectionMethod === 'manual' && (
							<Field label='Manual payment instructions' help='Use verified bank or payment details. These appear on the invoice.'>
								<textarea
									required
									className={fieldClass}
									rows={4}
									maxLength={2000}
									value={manualInstructions}
									onChange={(e) => setManualInstructions(e.target.value)}
								/>
							</Field>
						)}
						<Field label='Purchase'>
							<select className={fieldClass} value={kind} onChange={(e) => setKind(e.target.value as 'credits' | 'plan')}>
								<option value='credits'>Prepaid credits</option>
								<option value='plan'>Regular plan</option>
							</select>
						</Field>
						<Field label='Invoice currency'>
							<select className={fieldClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
								<option value='NGN'>NGN · Nigerian naira</option>
								<option value='USD'>USD · US dollars</option>
							</select>
						</Field>
						{kind === 'credits' ? (
							<Field label='Credits'>
								<input
									type='number'
									min='500'
									max='100000'
									step='100'
									required
									className={fieldClass}
									value={credits}
									onChange={(e) => setCredits(e.target.value)}
								/>
							</Field>
						) : (
							<Field label='Plan' help='Only plans approved for customer activation can be invoiced.'>
								<select
									required
									className={fieldClass}
									value={plan}
									onChange={(e) => setPlan(e.target.value)}
									disabled={plans.isLoading || !!plans.error}>
									<option value=''>{plans.isLoading ? 'Loading plans…' : 'Choose an eligible plan'}</option>
									{plans.data
										?.filter((p) => p.availableCurrencies.includes(currency))
										.map((p) => (
											<option key={p.lookupKey} value={p.lookupKey}>
												{p.name}
											</option>
										))}
								</select>
							</Field>
						)}
						<Field label='Due date' help='Within the next 90 days.'>
							<input required className={fieldClass} type='datetime-local' value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
						</Field>
					</div>
					<ErrorNotice error={kind === 'plan' ? plans.error : null} retry={() => void plans.refetch()} />
					{kind === 'credits' && (
						<div className='mt-5'>
							<label className='flex items-center gap-3 text-sm'>
								<input
									type='checkbox'
									className='h-4 w-4 accent-zinc-900'
									checked={customAmount}
									onChange={(e) => setCustomAmount(e.target.checked)}
								/>
								Use an agreed invoice amount
							</label>
							{customAmount ? (
								<div className='mt-3'>
									<Field
										label={`Agreed total (${currency})`}
										help='This amount buys the stated credit quantity. Review the quoted invoice before sending.'>
										<input
											type='text'
											inputMode='decimal'
											className={fieldClass}
											required
											value={amount}
											onChange={(e) => setAmount(e.target.value)}
										/>
									</Field>
								</div>
							) : (
								<p className='mt-2 text-xs text-zinc-500'>
									The draft will quote the current credit purchase rate. You can review the exact total before sending.
								</p>
							)}
						</div>
					)}
					{kind === 'credits' && (
						<div className='my-5 rounded-md border border-zinc-200 p-4'>
							<label className='flex items-center gap-3 text-sm font-medium'>
								<input type='checkbox' className='h-4 w-4 accent-zinc-900' checked={intel} onChange={(e) => setIntel(e.target.checked)} />
								Include 14 days of complimentary Intel
							</label>
							{intel && (
								<div className='mt-4'>
									<Field label='Intel promotional plan lookup key'>
										<input required className={fieldClass} value={intelPlan} onChange={(e) => setIntelPlan(e.target.value)} />
									</Field>
									<p className='mt-3 text-xs leading-5 text-zinc-600'>
										Starts after verified payment. Intel is excluded from the purchased credits until the customer explicitly agrees to
										pay-as-you-go. Without consent, access stops at expiry.
									</p>
								</div>
							)}
						</div>
					)}
					<Field label='Invoice note (optional)'>
						<textarea className={fieldClass} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
					</Field>
					<ErrorNotice error={error} />
					<div className='mt-5 flex justify-end gap-2'>
						<Button type='button' variant='outline' disabled={create.isPending} onClick={() => setCreating(false)}>
							Cancel
						</Button>
						<Button type='submit' variant='black' isLoading={create.isPending}>
							Save invoice draft
						</Button>
					</div>
				</form>
			</Dialog>
			<Dialog
				isOpen={!!delivery}
				onOpenChange={(open) => {
					if (!open && !send.isPending) setDelivery(null);
				}}
				title={
					delivery === 'review'
						? 'Send invoice for review'
						: delivery === 'revoke'
							? 'Revoke this invoice?'
							: delivery === 'issue'
								? 'Issue this invoice?'
								: delivery === 'prepare'
									? invoice?.collectionMethod === 'manual'
										? 'Prepare manual invoice'
										: 'Prepare customer payment link'
									: 'Send invoice to customer'
				}
				description={
					delivery === 'review'
						? 'Only the review recipients below will receive this invoice and its PDF. The customer will not be emailed.'
						: delivery === 'revoke'
							? 'The customer will no longer be able to start payment from this invoice.'
							: delivery === 'issue'
								? 'This makes the reviewed invoice payable. No email is sent in this step.'
								: delivery === 'prepare'
									? invoice?.collectionMethod === 'manual'
										? 'Creates an unpaid invoice attributed to the verified customer workspace. Actual received payments are recorded separately; no email is sent.'
										: 'Creates the unpaid invoice and hosted checkout for the verified customer workspace. It does not charge a card or send email.'
									: 'This sends the issued invoice, payment invitation and PDF to the customer.'
				}>
				{invoice && (
					<p className='mb-4 text-sm font-medium'>
						{invoice.invoiceNumber} · {invoiceMoney(invoice.amountMinor, invoice.currency)}
					</p>
				)}
				{delivery === 'prepare' && (
					<div className='mb-4'>
						<Field label='Customer workspace ID' help='The recipient must be the verified owner of this workspace.'>
							<input className={fieldClass} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
						</Field>
					</div>
				)}
				{delivery === 'review' ? (
					<Field label='Review recipients' help='Separate email addresses with commas.'>
						<input
							className={fieldClass}
							value={reviewEmails}
							onChange={(e) => setReviewEmails(e.target.value)}
							placeholder='reviewer@example.com'
						/>
					</Field>
				) : (
					<label className='flex items-start gap-3 text-sm leading-6'>
						<input
							type='checkbox'
							className='mt-1 h-4 w-4 accent-zinc-900'
							checked={acknowledged}
							onChange={(e) => setAcknowledged(e.target.checked)}
						/>
						<span>
							{delivery === 'revoke' ? (
								'I have reviewed this invoice and want to revoke it.'
							) : delivery === 'issue' ? (
								'I have reviewed the amount, recipient and access terms and want to issue this invoice.'
							) : delivery === 'prepare' ? (
								<>
									I have confirmed this workspace belongs to <strong>{invoice?.recipientEmail}</strong> and want to prepare payment.
								</>
							) : (
								<>
									I have reviewed this invoice and want to send it to <strong>{invoice?.recipientEmail}</strong>.
								</>
							)}
						</span>
					</label>
				)}
				<ErrorNotice error={sendingError} />
				<div className='mt-5 flex justify-end gap-2'>
					<Button variant='outline' disabled={send.isPending} onClick={() => setDelivery(null)}>
						Cancel
					</Button>
					<Button
						variant={delivery === 'revoke' ? 'destructive' : 'black'}
						isLoading={send.isPending}
						disabled={delivery === 'review' ? !reviewEmails.trim() : !acknowledged || (delivery === 'prepare' && !workspaceId.trim())}
						onClick={() => send.mutate()}>
						{delivery === 'review'
							? 'Send review copy'
							: delivery === 'revoke'
								? 'Revoke invoice'
								: delivery === 'issue'
									? 'Issue invoice'
									: delivery === 'prepare'
										? invoice?.collectionMethod === 'manual'
											? 'Prepare manual invoice'
											: 'Prepare payment link'
										: 'Send to customer'}
					</Button>
				</div>
			</Dialog>
		</BillingPage>
	);
}
