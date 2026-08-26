import { Chip, Progress, Tooltip } from '@/components/atoms';
import { ColumnData, FlexpriceTable, RedirectCell } from '@/components/molecules';
import { RouteNames } from '@/core/routes/Routes';
import { FEATURE_TYPE } from '@/models/Feature';
import { FC } from 'react';
import { getFeatureIcon } from '@/components/atoms/SelectFeature/SelectFeature';
import CustomerUsage, { EntitlementSource, ENTITLEMENT_SOURCE_ENTITY_TYPE } from '@/models/CustomerUsage';
import { formatAmount } from '@/components/atoms/Input/Input';

interface Props {
	data: CustomerUsage[];
	allowRedirect?: boolean;
}

export const getFeatureTypeChips = ({
	type,
	showIcon = false,
	showLabel = false,
}: {
	type: string;
	showIcon?: boolean;
	showLabel?: boolean;
}) => {
	const icon = getFeatureIcon(type);
	switch (type.toLocaleLowerCase()) {
		case FEATURE_TYPE.STATIC: {
			return <Chip variant='default' icon={showIcon && icon} label={showLabel && 'Static'} />;
		}
		case FEATURE_TYPE.METERED:
			return <Chip textColor='#1E3A8A' bgColor='#F0F9FF' icon={showIcon && icon} label={showLabel && 'Metered'} />;
		case FEATURE_TYPE.BOOLEAN:
			return <Chip textColor='#075985' bgColor='#F0F9FF' icon={showIcon && icon} label={showLabel && 'Boolean'} />;
		case FEATURE_TYPE.CONFIG:
			return <Chip textColor='#6B21A8' bgColor='#FAF5FF' icon={showIcon && icon} label={showLabel && 'Configuration'} />;
		default:
			return <Chip textColor='#075985' bgColor='#F0F9FF' icon={showIcon && icon} label={showLabel && '--'} />;
	}
};

const getFeatureValue = (data: CustomerUsage) => {
	switch (data.feature.type) {
		case FEATURE_TYPE.STATIC:
			return data.sources?.[0]?.static_value ?? '--';
		case FEATURE_TYPE.METERED:
			return (
				<span className='flex items-end gap-1'>
					{data.is_unlimited ? 'Unlimited' : data.total_limit ? formatAmount(data.total_limit?.toString()) : 'Unlimited'}
					<span className='text-[#64748B] text-sm font-normal font-sans'>units</span>
				</span>
			);
		case FEATURE_TYPE.BOOLEAN:
			return data.is_enabled ? 'True' : 'False';
		case FEATURE_TYPE.CONFIG:
			return data.sources?.[0]?.config_value ? JSON.stringify(data.sources[0].config_value) : '--';
		default:
			return '--';
	}
};

const getRedirectUrl = (source: EntitlementSource | undefined): string | undefined => {
	if (!source) {
		return undefined;
	}

	// Prefer entity_type and entity_id if available
	if (source.entity_type && source.entity_id) {
		if (source.entity_type === ENTITLEMENT_SOURCE_ENTITY_TYPE.PLAN) {
			return `${RouteNames.plan}/${source.entity_id}`;
		} else if (source.entity_type === ENTITLEMENT_SOURCE_ENTITY_TYPE.ADDON) {
			return `${RouteNames.addonDetails}/${source.entity_id}`;
		}
		// subscription type doesn't have a direct redirect URL
	}

	// Fallback to old plan_id if entity fields are not available
	if (source.plan_id) {
		return `${RouteNames.plan}/${source.plan_id}`;
	}

	return undefined;
};

const getEntityName = (source: EntitlementSource | undefined): string => {
	// Prefer entity_name if available, otherwise fallback to plan_name
	return source?.entity_name || source?.plan_name || '--';
};

const CustomerUsageTable: FC<Props> = ({ data, allowRedirect = true }) => {
	const columnData: ColumnData<CustomerUsage>[] = [
		{
			title: 'Feature',

			render(row) {
				return (
					<RedirectCell allowRedirect={allowRedirect} redirectUrl={`${RouteNames.featureDetails}/${row?.feature?.id}`}>
						{getFeatureTypeChips({
							type: row?.feature?.type || '',
							showIcon: true,
						})}
						{row?.feature?.name}
					</RedirectCell>
				);
			},
		},
		{
			title: 'Plan',
			render(row) {
				const sources = row?.sources || [];

				if (sources.length === 0) {
					return '--';
				}

				// Single source - always show with redirect if URL is available
				if (sources.length === 1) {
					const source = sources[0];
					const redirectUrl = getRedirectUrl(source);
					const entityName = getEntityName(source);

					// Always use RedirectCell for single source if we have a URL
					if (redirectUrl) {
						return (
							<RedirectCell allowRedirect={allowRedirect} redirectUrl={redirectUrl}>
								{entityName}
							</RedirectCell>
						);
					}

					// Fallback: show without redirect if no URL available
					return <span>{entityName}</span>;
				}

				// Multiple sources - show primary (0th index) with tooltip containing all sources
				const primarySource = sources[0];
				const entityName = getEntityName(primarySource);
				const additionalCount = sources.length - 1;

				const displayContent = (
					<span>
						{entityName}
						{additionalCount > 0 && <span className='text-[#64748B] text-sm ml-1'>+{additionalCount}</span>}
					</span>
				);

				// Tooltip content with all sources and their redirect links
				const tooltipContent = (
					<div className='flex flex-col gap-2 max-w-xs'>
						{sources.map((source, index) => {
							const sourceName = getEntityName(source);
							const sourceRedirectUrl = getRedirectUrl(source);

							return (
								<div key={source.entitlement_id || index} className='flex items-center gap-2'>
									{sourceRedirectUrl && allowRedirect ? (
										<RedirectCell allowRedirect={allowRedirect} redirectUrl={sourceRedirectUrl}>
											<span className='text-sm'>{sourceName}</span>
										</RedirectCell>
									) : (
										<span className='text-sm'>{sourceName}</span>
									)}
								</div>
							);
						})}
					</div>
				);

				return (
					<Tooltip delayDuration={0} sideOffset={15} content={tooltipContent}>
						<span className='cursor-pointer'>{displayContent}</span>
					</Tooltip>
				);
			},
		},
		{
			title: 'Value',
			render(row) {
				return getFeatureValue(row);
			},
		},
		{
			title: 'Usage',
			render(row) {
				if (row?.feature?.type != FEATURE_TYPE.METERED) {
					return '--';
				}
				const usage = Number(row?.current_usage);
				const limit = row?.is_unlimited ? null : row?.total_limit ? Number(row.total_limit) : null;

				// Handle unlimited case
				if (row?.is_unlimited || !limit) {
					return (
						<Progress
							label={`${formatAmount(usage.toString())} / Unlimited`}
							value={0}
							className='h-[6px]'
							indicatorColor='bg-blue-600'
							backgroundColor='bg-blue-200'
						/>
					);
				}

				// Handle case with limit
				const value = Math.ceil((usage / limit) * 100);
				const indicatorColor = value >= 100 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-[#6167d9] to-[#2563eb]';

				const backgroundColor = value >= 100 ? 'bg-red-50' : 'bg-blue-200';

				return (
					<Progress
						label={`${formatAmount(usage.toString())} / ${formatAmount(limit.toString())}`}
						value={value}
						className='h-[6px]'
						indicatorColor={indicatorColor}
						backgroundColor={backgroundColor}
					/>
				);
			},
		},
	];

	return (
		<div>
			<FlexpriceTable showEmptyRow data={data} columns={columnData} variant='no-bordered' />
		</div>
	);
};

export default CustomerUsageTable;
