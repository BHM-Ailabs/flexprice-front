import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog } from '@/components/atoms';
import {
	billingGet,
	billingPost,
	type CatalogDetail,
	type CatalogItem,
	type CatalogVersion,
	type MarkupPolicy,
} from '@/api/PlaqadBillingApi';
import { BillingPage, ErrorNotice, Field, Panel, date, fieldClass, number, tableClass } from './shared';
import { creditsAtMarkup, initialPolicy, percentBps, previewPrice, resolvedBps, uniformPolicy } from './pricing';

type Draft = { items: CatalogItem[]; policy: MarkupPolicy; sourceVersion: number };
export default function MarkupPage() {
	const client = useQueryClient();
	const versions = useQuery({
		queryKey: ['plaqad-catalog'],
		queryFn: () => billingGet<{ versions: CatalogVersion[] }>('/catalog/versions'),
	});
	const [selected, setSelected] = useState<number | null>(null);
	const version = selected ?? versions.data?.versions.find((v) => v.status === 'active')?.version ?? versions.data?.versions[0]?.version;
	const detail = useQuery({
		queryKey: ['plaqad-catalog', version],
		queryFn: () => billingGet<CatalogDetail>(`/catalog/versions/${version}`),
		enabled: version !== undefined,
	});
	const [draft, setDraft] = useState<Draft | null>(null);
	const [globalPercent, setGlobalPercent] = useState('50');
	const [effectiveAt, setEffectiveAt] = useState('');
	const [notes, setNotes] = useState('');
	const [search, setSearch] = useState('');
	const [error, setError] = useState<unknown>(null);
	const [notice, setNotice] = useState('');
	const [activation, setActivation] = useState(false);
	const [reason, setReason] = useState('');
	const [uniform, setUniform] = useState(false);
	const [overrides, setOverrides] = useState<Record<string, string>>({});
	const [skuOverrides, setSkuOverrides] = useState<Record<string, string>>({});

	function currentDraft(): Draft {
		if (!draft) throw new Error('Create a pricing draft first.');
		const bps = percentBps(globalPercent);
		if (uniform) return { ...uniformPolicy(draft.items, bps), sourceVersion: draft.sourceVersion };
		const parseOverrides = (values: Record<string, string>) =>
			Object.fromEntries(
				Object.entries(values)
					.filter(([, value]) => value.trim())
					.map(([key, value]) => [key, percentBps(value)]),
			);
		return {
			...draft,
			policy: {
				...draft.policy,
				defaultMarkupBps: bps,
				classOverrides: parseOverrides(overrides),
				skuOverrides: parseOverrides(skuOverrides),
			},
		};
	}
	let preview: Draft | null = null;
	let validation = '';
	if (draft) {
		try {
			preview = currentDraft();
		} catch (cause) {
			validation = (cause as Error).message;
		}
	}
	const shownItems = preview?.items ?? draft?.items ?? detail.data?.items ?? [];
	const policy = preview?.policy ?? detail.data?.pricingPolicy;
	const changes = preview?.items.filter((item) => previewPrice(item, preview!.policy) !== item.creditPrice).length ?? 0;
	const fixedCount = shownItems.filter((item) => item.active && item.pricingMode === 'fixed').length;
	const exampleCredits = draft && !validation ? creditsAtMarkup(5000000, percentBps(globalPercent)) : null;
	const classes = [...new Set(shownItems.filter((item) => item.pricingMode === 'markup').map((item) => item.pricingClass))].sort();
	const filteredItems = shownItems.filter((item) => `${item.sku} ${item.displayName}`.toLowerCase().includes(search.toLowerCase()));

	function startDraft() {
		if (!detail.data) return;
		const policy = detail.data.pricingPolicy ?? initialPolicy;
		setDraft({ items: detail.data.items.map((item) => ({ ...item })), policy, sourceVersion: detail.data.version });
		setGlobalPercent(String(policy.defaultMarkupBps / 100));
		setOverrides(Object.fromEntries(Object.entries(policy.classOverrides).map(([key, bps]) => [key, String(bps / 100)])));
		setSkuOverrides(Object.fromEntries(Object.entries(policy.skuOverrides).map(([key, bps]) => [key, String(bps / 100)])));
		setUniform(false);
		setNotes(`Usage pricing copied from version ${detail.data.version}.`);
		setEffectiveAt('');
		setError(null);
		setNotice('');
	}
	const save = useMutation({
		mutationFn: async () => {
			const next = currentDraft();
			return billingPost<CatalogDetail>('/catalog/versions', {
				effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : new Date().toISOString(),
				notes,
				pricingPolicy: next.policy,
				items: next.items.map((item) => ({ ...item, creditPrice: previewPrice(item, next.policy) })),
			});
		},
		onSuccess: (result) => {
			setDraft(null);
			setSelected(result.version);
			setNotice(`Draft version ${result.version} saved. Review it before activation.`);
			void client.invalidateQueries({ queryKey: ['plaqad-catalog'] });
		},
		onError: setError,
	});
	const activate = useMutation({
		mutationFn: () => billingPost<{ status: string }>(`/catalog/versions/${version}/activate`, { reason: reason.trim() }),
		onSuccess: (result) => {
			setActivation(false);
			setReason('');
			setNotice(
				result.status === 'scheduled'
					? 'Pricing activation scheduled.'
					: 'Pricing version activated. New usage will adopt the updated prices.',
			);
			void client.invalidateQueries({ queryKey: ['plaqad-catalog'] });
		},
		onError: setError,
	});

	return (
		<BillingPage
			title='Usage markup'
			description='Set how provider costs translate into credits spent. Purchasing credits still costs US$0.01 per credit before currency conversion.'>
			<ErrorNotice
				error={versions.error || detail.error || error}
				retry={() => {
					void versions.refetch();
					void detail.refetch();
				}}
			/>
			{notice && (
				<p role='status' className='mb-5 rounded-md bg-zinc-100 p-4 text-sm'>
					{notice}
				</p>
			)}
			{versions.isLoading || detail.isLoading ? (
				<p role='status'>Loading pricing…</p>
			) : (
				<>
					<div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
						<Field label='Pricing version'>
							<select
								className={fieldClass}
								value={version ?? ''}
								disabled={!!draft}
								onChange={(event) => {
									setSelected(Number(event.target.value));
									setError(null);
								}}>
								{versions.data?.versions.map((v) => (
									<option key={v.version} value={v.version}>
										Version {v.version} · {v.status}
										{v.approvedAt && v.status === 'draft' ? ' · scheduled' : ''}
									</option>
								))}
							</select>
						</Field>
						{detail.data && !draft && (
							<div className='flex flex-wrap gap-2'>
								<Button variant='outline' onClick={startDraft}>
									Create a pricing draft
								</Button>
								{detail.data.status === 'draft' && !detail.data.approvedAt && (
									<Button
										variant='black'
										onClick={() => {
											setError(null);
											setActivation(true);
										}}>
										Review activation
									</Button>
								)}
							</div>
						)}
					</div>
					{draft && (
						<Panel title='Draft consumption pricing'>
							<div className='grid gap-6 md:grid-cols-2'>
								<Field label='Global markup (%)' help='30% markup on $5 provider cost adds $1.50, for 650 credits total.'>
									<input
										className={fieldClass}
										type='number'
										min='0'
										max='1000'
										step='0.01'
										value={globalPercent}
										onChange={(e) => setGlobalPercent(e.target.value)}
									/>
								</Field>
								<div className='rounded-md bg-zinc-50 p-4 text-sm leading-6'>
									<p className='font-medium'>A $5 operation would use</p>
									<p className='my-2 text-3xl font-medium tabular-nums'>
										{exampleCredits === null ? '—' : number(exampleCredits)}{' '}
										<span className='text-base font-normal text-zinc-500'>credits</span>
									</p>
									{exampleCredits !== null && <p className='mb-2 text-sm'>US${(exampleCredits / 100).toFixed(2)} in credit value</p>}
									<p className='text-xs text-zinc-500'>
										At the global rate. Overrides and rounding can change individual operation charges.
									</p>
								</div>
							</div>
							<label className='my-5 flex items-start gap-3 rounded-md border border-zinc-200 p-4 text-sm'>
								<input
									type='checkbox'
									className='mt-1 h-4 w-4 accent-zinc-900'
									checked={uniform}
									onChange={(e) => setUniform(e.target.checked)}
								/>
								<span>
									<strong className='font-medium'>Use this markup for every item with a provider cost</strong>
									<span className='mt-1 block text-zinc-600'>
										Clears every class and individual override and converts fixed items with a positive cost. Items without a provider cost
										retain their fixed price.
									</span>
								</span>
							</label>
							{!uniform && (
								<>
									<p className='mb-3 text-sm text-zinc-600'>
										Existing class and individual overrides take priority over the global rate. Fixed prices are preserved.
									</p>
									<div className='grid gap-4 sm:grid-cols-3'>
										{classes.map((name) => (
											<Field key={name} label={`${name} markup (%)`} help='Leave blank to use the global rate.'>
												<input
													className={fieldClass}
													type='number'
													min='0'
													max='1000'
													step='0.01'
													value={overrides[name] ?? ''}
													placeholder={globalPercent}
													onChange={(e) => setOverrides({ ...overrides, [name]: e.target.value })}
												/>
											</Field>
										))}
									</div>
									{Object.keys(skuOverrides).filter((key) => skuOverrides[key]).length > 0 && (
										<p className='mt-3 text-xs text-zinc-600'>
											{Object.keys(skuOverrides).filter((key) => skuOverrides[key]).length} individual overrides remain. Review them in the
											price table.
										</p>
									)}
								</>
							)}
							<div className='mt-5 grid gap-4 sm:grid-cols-2'>
								<Field label='Effective date' help='Leave blank to allow activation immediately after review.'>
									<input
										className={fieldClass}
										type='datetime-local'
										value={effectiveAt}
										onChange={(e) => setEffectiveAt(e.target.value)}
									/>
								</Field>
								<Field label='Pricing notes'>
									<input className={fieldClass} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
								</Field>
							</div>
							{validation && (
								<p role='alert' className='mt-3 text-sm text-red-700'>
									{validation}
								</p>
							)}
							<div className='mt-5 flex flex-wrap items-center gap-3'>
								<Button
									variant='black'
									disabled={!!validation}
									isLoading={save.isPending}
									onClick={() => {
										setError(null);
										save.mutate();
									}}>
									Save draft
								</Button>
								<Button variant='outline' disabled={save.isPending} onClick={() => setDraft(null)}>
									Discard draft
								</Button>
								<span className='text-sm text-zinc-600'>
									{changes} item prices change · {fixedCount} active fixed prices remain
								</span>
							</div>
						</Panel>
					)}
					{!draft && detail.data && (
						<Panel title={`Version ${detail.data.version} · ${detail.data.status}`}>
							<p className='mb-2 text-sm text-zinc-600'>
								Effective: {date(detail.data.effectiveAt)}
								{detail.data.approvedAt ? ` · Approved: ${date(detail.data.approvedAt)}` : ''}
							</p>
							<p className='text-sm'>
								{detail.data.pricingPolicy
									? `Global markup ${detail.data.pricingPolicy.defaultMarkupBps / 100}%. Class and individual overrides take priority.`
									: 'This version uses fixed prices. Create a draft and choose uniform markup to convert items with a provider cost.'}
							</p>
							{detail.data.notes && <p className='mt-2 text-sm text-zinc-500'>{detail.data.notes}</p>}
						</Panel>
					)}
					<Panel title={draft ? 'Review price changes' : 'Operation prices'}>
						<div className='mb-4 max-w-sm'>
							<Field label='Find an operation'>
								<input
									type='search'
									className={fieldClass}
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder='Search name or operation key'
								/>
							</Field>
						</div>
						<p className='mb-3 text-xs text-zinc-500'>
							Prices below are for each listed unit quantity. Usage is rounded to whole credits across a batch.
						</p>
						<div className='overflow-x-auto'>
							<table className={tableClass}>
								<thead>
									<tr>
										<th>Operation</th>
										<th>Quantity</th>
										<th>Provider cost</th>
										<th>Markup</th>
										{draft && <th>Individual override (%)</th>}
										<th>{draft ? 'Current → draft credits' : 'Credits'}</th>
									</tr>
								</thead>
								<tbody>
									{filteredItems.map((item) => (
										<tr key={item.sku} className={!item.active ? 'text-zinc-400' : ''}>
											<td>
												<span className='block font-medium'>{item.displayName}</span>
												<span className='block max-w-xs break-words text-xs text-zinc-500'>
													{item.sku}
													{!item.active ? ' · inactive' : ''}
												</span>
											</td>
											<td className='whitespace-nowrap'>
												{number(item.unitScale)} {item.unit}
											</td>
											<td className='tabular-nums'>
												$
												{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(
													item.usdCostMicro / 1000000,
												)}
											</td>
											<td>{policy && resolvedBps(item, policy) !== null ? `${resolvedBps(item, policy)! / 100}%` : 'Fixed'}</td>
											{draft && (
												<td>
													{!uniform && item.pricingMode === 'markup' ? (
														<input
															aria-label={`Markup override for ${item.sku}`}
															type='number'
															min='0'
															max='1000'
															step='0.01'
															className={`${fieldClass} min-w-24`}
															value={skuOverrides[item.sku] ?? ''}
															placeholder='Inherit'
															onChange={(e) => setSkuOverrides({ ...skuOverrides, [item.sku]: e.target.value })}
														/>
													) : (
														'—'
													)}
												</td>
											)}
											<td className='whitespace-nowrap tabular-nums'>
												{number(item.creditPrice)}
												{preview && (
													<>
														<span className='px-2 text-zinc-400'>→</span>
														<strong className='font-medium'>{number(previewPrice(item, preview.policy))}</strong>
													</>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{filteredItems.length === 0 && <p className='p-4 text-sm text-zinc-500'>No operations match your search.</p>}
						</div>
					</Panel>
				</>
			)}
			<Dialog
				isOpen={activation}
				onOpenChange={(open) => {
					if (!activate.isPending) setActivation(open);
				}}
				title={`Activate pricing version ${version}?`}
				description='This changes credits deducted for new usage after products refresh their prices. Existing purchases and previously rated usage retain their original amounts.'>
				<p className='mb-4 text-sm'>
					Effective date: {date(detail.data?.effectiveAt ?? null)}. Review the operation prices before continuing.
				</p>
				<Field label='Reason for this pricing change'>
					<textarea className={fieldClass} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
				</Field>
				<ErrorNotice error={activate.error} />
				<div className='mt-5 flex justify-end gap-2'>
					<Button variant='outline' disabled={activate.isPending} onClick={() => setActivation(false)}>
						Cancel
					</Button>
					<Button variant='black' disabled={!reason.trim()} isLoading={activate.isPending} onClick={() => activate.mutate()}>
						Activate version {version}
					</Button>
				</div>
			</Dialog>
		</BillingPage>
	);
}
