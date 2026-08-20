import MultiSelect from '@/components/atoms/MultiSelect';
import { cn } from '@/lib/utils';
import Feature, { FEATURE_TYPE } from '@/models/Feature';
import FeatureApi from '@/api/FeatureApi';
import { useQuery } from '@tanstack/react-query';
import { Braces, Gauge, SquareCheckBig, Wrench, ChevronDown } from 'lucide-react';
import React, { FC, useEffect } from 'react';
import { ENTITY_STATUS } from '@/models/base';
import { Skeleton } from '@/components/ui';

const fetchFeatures = async () => {
	return await FeatureApi.listFeatures({
		status: ENTITY_STATUS.PUBLISHED,
		limit: 1000,
	});
};

interface Props {
	onChange: (values: Feature[]) => void;
	values?: string[];
	error?: string;
	label?: string;
	placeholder?: string;
	description?: string;
	className?: string;
	disabledFeatures?: string[];
	maxCount?: number;
	onFeaturesFetched?: (features: Feature[]) => void;
}

const getFeatureIcon = (featureType: string) => {
	const className = 'size-4 opacity-80 text-muted-foreground';
	if (featureType === FEATURE_TYPE.BOOLEAN) {
		return <SquareCheckBig className={className} />;
	} else if (featureType === FEATURE_TYPE.METERED) {
		return <Gauge className={className} />;
	} else if (featureType === FEATURE_TYPE.STATIC) {
		return <Wrench className={className} />;
	} else if (featureType === FEATURE_TYPE.CONFIG) {
		return <Braces className={className} />;
	}
};

const FeatureMultiSelect: FC<Props> = ({
	onChange,
	values = [],
	error,
	label: _label = 'Features',
	placeholder = 'Select features',
	description,
	className,
	disabledFeatures,
	maxCount,
	onFeaturesFetched,
}) => {
	const [selectedCount, setSelectedCount] = React.useState(values.length);

	const {
		data: featuresData,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ['fetchFeatures2'],
		queryFn: fetchFeatures,
	});

	// Call the callback when features are fetched
	useEffect(() => {
		if (featuresData?.items && onFeaturesFetched) {
			onFeaturesFetched(featuresData.items);
		}
	}, [featuresData, onFeaturesFetched]);

	if (isLoading) {
		return (
			<div className={cn('w-full')}>
				{_label && <Skeleton className='h-5 w-20 mb-1' />}
				<Skeleton className='h-10 w-full' />
			</div>
		);
	}

	if (isError) {
		return <div>Error</div>;
	}

	if (!featuresData) {
		return <div>No Features found</div>;
	}

	const options = featuresData.items
		.map((feature: Feature) => ({
			value: feature.id,
			label: feature.name,
			icon: () => getFeatureIcon(feature.type),
			disabled: disabledFeatures?.includes(feature.id) || false,
		}))
		.sort((a, b) => {
			const aDisabled = a.disabled;
			const bDisabled = b.disabled;
			if (aDisabled && !bDisabled) return 1;
			if (!aDisabled && bDisabled) return -1;
			return 0;
		});

	return (
		<div className={cn('w-full')}>
			{_label && <label className={cn('block text-sm font-medium text-zinc-950 mb-1')}>{_label}</label>}
			<MultiSelect
				options={options}
				onValueChange={(selectedValues) => {
					setSelectedCount(selectedValues.length);
					// Filter out any disabled options from selectedValues
					const enabledSelectedValues = selectedValues.filter((value) => {
						const option = options.find((o) => o.value === value);
						return !option?.disabled;
					});
					const selectedFeatures = featuresData.items.filter((feature: Feature) => enabledSelectedValues.includes(feature.id));
					onChange(selectedFeatures);
				}}
				defaultValue={values}
				placeholder={selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? 'feature' : 'features'} selected` : placeholder}
				maxCount={maxCount}
				className={cn('h-10', className)}
				triggerClassName='gap-2'
				customDisplay={(count) => {
					if (count === 0) return null;
					return (
						<div className='flex items-center justify-between w-full'>
							<span className='text-sm text-gray-900 font-normal'>
								{count} {count === 1 ? 'feature' : 'features'} selected
							</span>
							<ChevronDown className='h-4 w-4 text-gray-500 shrink-0' />
						</div>
					);
				}}
			/>
			{description && <p className='text-sm text-muted-foreground mt-1'>{description}</p>}
			{error && <p className='text-sm text-red-500 mt-1'>{error}</p>}
		</div>
	);
};

export default FeatureMultiSelect;
