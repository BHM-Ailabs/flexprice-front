import { Checkbox, Input, Select, SelectOption, Textarea } from '@/components/atoms';
import { PLAQAD_PRODUCT_OPTIONS } from '@/constants/plaqad';
import { Metadata } from '@/models';
import { applyPlanWebsiteSettings, planWebsiteSettingsFromMetadata, PlanWebsiteSettings } from '@/lib/planWebsiteSettings';

interface WebsitePublishingSectionProps {
	metadata?: Metadata;
	onChange: (metadata: Metadata) => void;
}

const CTA_ACTION_OPTIONS: SelectOption[] = [
	{
		value: 'auto',
		label: 'Automatic (recommended)',
		description: 'Use Subscribe now for a recurring fixed price; otherwise use Talk to sales.',
	},
	{
		value: 'subscribe',
		label: 'Subscribe now',
		description: 'Send the buyer to Plaqad Account to choose a workspace and pay securely.',
	},
	{
		value: 'sales',
		label: 'Talk to sales',
		description: 'Send the buyer to the Plaqad contact page.',
	},
	{
		value: 'custom',
		label: 'Custom website link',
		description: 'Use a specific page on the Plaqad website.',
	},
];

const WebsitePublishingSection = ({ metadata = {}, onChange }: WebsitePublishingSectionProps) => {
	const settings = planWebsiteSettingsFromMetadata(metadata);
	const update = (changes: Partial<PlanWebsiteSettings>) => {
		onChange(applyPlanWebsiteSettings(metadata, { ...settings, ...changes }));
	};
	const toggleProduct = (product: string, checked: boolean) => {
		const products = checked ? [...settings.products, product] : settings.products.filter((item) => item !== product);
		update({ products: [...new Set(products)] });
	};

	return (
		<section className='rounded-[6px] border border-gray-300 p-5' aria-labelledby='website-publishing-title'>
			<div className='mb-5'>
				<h3 id='website-publishing-title' className='text-sm font-semibold text-zinc-950'>
					Website publishing
				</h3>
				<p className='mt-1 text-sm text-zinc-600'>Control where this plan appears without editing metadata keys.</p>
			</div>

			<Checkbox
				id='plan-website-public'
				checked={settings.public}
				onCheckedChange={(checked) => update({ public: checked })}
				label='Show this plan on the Plaqad website'
				description='Publishes the plan on the main pricing page and any selected product pages.'
			/>

			{settings.public && (
				<div className='mt-6 space-y-6'>
					<div>
						<p className='text-sm font-medium text-zinc-950'>Product pages</p>
						<p className='mt-1 text-sm text-zinc-600'>
							Choose one or more products. Leave all unchecked to infer targeting from linked entitlements.
						</p>
						<div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
							{PLAQAD_PRODUCT_OPTIONS.map((option) => (
								<Checkbox
									key={option.value}
									id={`plan-product-${option.value}`}
									checked={settings.products.includes(option.value)}
									onCheckedChange={(checked) => toggleProduct(option.value, checked)}
									label={option.label}
								/>
							))}
						</div>
					</div>

					<Input
						label='Website summary'
						description='Short supporting line shown below the plan name. The plan description is used when blank.'
						placeholder='Start with the essentials for your team.'
						value={settings.summary}
						onChange={(summary) => update({ summary })}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<Input
							label='Price label override'
							description='Optional. FlexPrice pricing is used automatically when blank.'
							placeholder='$30 / month'
							value={settings.priceLabel}
							onChange={(priceLabel) => update({ priceLabel })}
						/>
						<Input
							label='Billing note'
							placeholder='Billed monthly'
							value={settings.billingNote}
							onChange={(billingNote) => update({ billingNote })}
						/>
						<Input label='Badge' placeholder='Best for small teams' value={settings.badge} onChange={(badge) => update({ badge })} />
						<Input
							label='Display order'
							description='Lower numbers appear first.'
							placeholder='10'
							variant='integer'
							value={settings.displayOrder}
							onChange={(displayOrder) => update({ displayOrder })}
						/>
					</div>

					<Textarea
						label='Feature highlights'
						description='Optional marketing highlights, one per line. Linked FlexPrice entitlements are shown automatically.'
						placeholder={'Priority monitoring\nWeekly executive brief'}
						value={settings.features.join('\n')}
						onChange={(value) =>
							update({
								features: value
									.split('\n')
									.map((item) => item.trim())
									.filter(Boolean),
							})
						}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<Select
							label='Button action'
							description='Choose the website behavior without entering a route.'
							options={CTA_ACTION_OPTIONS}
							value={settings.ctaAction}
							onChange={(ctaAction) => update({ ctaAction: ctaAction as PlanWebsiteSettings['ctaAction'] })}
						/>
						<Input
							label='Button label'
							description='Optional. The selected action supplies a default label.'
							placeholder={settings.ctaAction === 'subscribe' ? 'Subscribe now' : 'Talk to sales'}
							value={settings.ctaLabel}
							onChange={(ctaLabel) => update({ ctaLabel })}
						/>
						{settings.ctaAction === 'custom' ? (
							<Input
								label='Custom website path'
								description='Use a Plaqad website path beginning with /.'
								placeholder='/contact'
								value={settings.ctaHref}
								onChange={(ctaHref) => update({ ctaHref })}
							/>
						) : null}
					</div>

					<Checkbox
						id='plan-website-highlight'
						checked={settings.highlight}
						onCheckedChange={(checked) => update({ highlight: checked })}
						label='Highlight this plan'
						description='Applies the featured treatment on public pricing surfaces.'
					/>
				</div>
			)}
		</section>
	);
};

export default WebsitePublishingSection;
