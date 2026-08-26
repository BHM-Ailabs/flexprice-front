import { AddButton, Page, ActionButton, Chip } from '@/components/atoms';
import { ApiDocsContent, FeatureDrawer, RedirectCell } from '@/components/molecules';
import { ColumnData } from '@/components/molecules/Table';
import { QueryableDataArea } from '@/components/organisms';
import { RouteNames } from '@/core/routes/Routes';
import GUIDES from '@/constants/guides';
import FeatureApi from '@/api/FeatureApi';
import { Link, useNavigate } from 'react-router';
import { useState, useMemo } from 'react';
import Feature, { FEATURE_TYPE } from '@/models/Feature';
import {
	FilterField,
	FilterFieldType,
	DEFAULT_OPERATORS_PER_DATA_TYPE,
	DataType,
	FilterOperator,
	SortOption,
	SortDirection,
	FilterCondition,
} from '@/types/common/QueryBuilder';
import { ENTITY_STATUS } from '@/models';
import { toSentenceCase } from '@/utils/common/helper_functions';
import formatChips from '@/utils/common/format_chips';
import formatDate from '@/utils/common/format_date';
import { getFeatureIcon } from '@/components/atoms/SelectFeature/SelectFeature';
import { searchGroupsForFilter } from '@/utils/filterSearchHelpers';

const sortingOptions: SortOption[] = [
	{
		field: 'name',
		label: 'Name',
		direction: SortDirection.ASC,
	},
	{
		field: 'created_at',
		label: 'Created At',
		direction: SortDirection.DESC,
	},
	{
		field: 'updated_at',
		label: 'Updated At',
		direction: SortDirection.DESC,
	},
];

const filterOptions: FilterField[] = [
	{
		field: 'name',
		label: 'Name',
		fieldType: FilterFieldType.INPUT,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.STRING],
		dataType: DataType.STRING,
	},
	{
		field: 'created_at',
		label: 'Created At',
		fieldType: FilterFieldType.DATEPICKER,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.DATE],
		dataType: DataType.DATE,
	},
	{
		field: 'status',
		label: 'Status',
		fieldType: FilterFieldType.MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		options: [
			{ value: ENTITY_STATUS.PUBLISHED, label: 'Active' },
			{ value: ENTITY_STATUS.ARCHIVED, label: 'Inactive' },
		],
	},
	{
		field: 'type',
		label: 'Type',
		fieldType: FilterFieldType.MULTI_SELECT,
		operators: DEFAULT_OPERATORS_PER_DATA_TYPE[DataType.ARRAY],
		dataType: DataType.ARRAY,
		options: [
			{ value: FEATURE_TYPE.METERED, label: 'Metered' },
			{ value: FEATURE_TYPE.BOOLEAN, label: 'Boolean' },
			{ value: FEATURE_TYPE.STATIC, label: 'Static' },
			{ value: FEATURE_TYPE.CONFIG, label: 'Configuration' },
		],
	},
	{
		field: 'group_id',
		label: 'Group',
		fieldType: FilterFieldType.ASYNC_MULTI_SELECT,
		operators: [FilterOperator.IN, FilterOperator.NOT_IN],
		dataType: DataType.ARRAY,
		asyncConfig: {
			searchFn: searchGroupsForFilter,
		},
	},
];

const initialFilters: FilterCondition[] = [
	{
		field: 'name',
		operator: FilterOperator.CONTAINS,
		valueString: '',
		dataType: DataType.STRING,
		id: 'initial-name',
	},
	{
		field: 'status',
		operator: FilterOperator.IN,
		valueArray: [ENTITY_STATUS.PUBLISHED],
		dataType: DataType.ARRAY,
		id: 'initial-status',
	},
];

const initialSorts: SortOption[] = [
	{
		field: 'updated_at',
		label: 'Updated At',
		direction: SortDirection.DESC,
	},
];

const getFeatureTypeChips = (type: string, addIcon: boolean = false) => {
	const icon = getFeatureIcon(type);
	switch (type.toLocaleLowerCase()) {
		case FEATURE_TYPE.STATIC: {
			return <Chip textColor='#4B5563' bgColor='#F3F4F6' icon={addIcon ? icon : null} label={toSentenceCase(type)} className='text-xs' />;
		}
		case FEATURE_TYPE.METERED:
			return <Chip textColor='#1E40AF' bgColor='#DBEAFE' icon={addIcon ? icon : null} label={toSentenceCase(type)} className='text-xs' />;
		case FEATURE_TYPE.BOOLEAN:
			return <Chip textColor='#166534' bgColor='#DCFCE7' icon={addIcon ? icon : null} label={toSentenceCase(type)} className='text-xs' />;
		case FEATURE_TYPE.CONFIG:
			return <Chip textColor='#6B21A8' bgColor='#F3E8FF' icon={addIcon ? icon : null} label='Configuration' className='text-xs' />;
		default:
			return <Chip textColor='#6B7280' bgColor='#F9FAFB' icon={addIcon ? icon : null} label={toSentenceCase(type)} className='text-xs' />;
	}
};

const FeaturesPage = () => {
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
	const navigate = useNavigate();

	const handleEdit = (feature: Feature) => {
		setSelectedFeature(feature);
		setIsDrawerOpen(true);
	};

	const columns: ColumnData<Feature>[] = useMemo(
		() => [
			{
				fieldName: 'name',
				title: 'Feature Name',
			},
			{
				title: 'Group',
				render: (row) =>
					row?.group?.id ? <RedirectCell redirectUrl={`${RouteNames.groups}/${row.group.id}`}>{row.group.name}</RedirectCell> : '—',
			},
			// {
			// 	title: 'Customer',
			// 	render: (row) => (
			// 		<RedirectCell redirectUrl={`${RouteNames.customers}/${row.customer_id}`}>{row.customer?.name || row.customer_id}</RedirectCell>
			// 	),
			// },
			{
				title: 'Type',
				render(row) {
					return getFeatureTypeChips(row?.type || '', true);
				},
			},
			{
				title: 'Status',
				render: (row) => {
					const label = formatChips(row?.status);
					return <Chip variant={label === 'Active' ? 'success' : 'default'} label={label} />;
				},
			},
			{
				title: 'Updated At',
				render: (row) => {
					return formatDate(row?.updated_at);
				},
			},
			{
				fieldVariant: 'interactive',
				render(row) {
					return (
						<ActionButton
							id={row?.id}
							deleteMutationFn={async () => {
								return await FeatureApi.deleteFeature(row?.id);
							}}
							refetchQueryKey='fetchFeatures'
							entityName={row?.name}
							archive={{
								enabled: row?.status !== ENTITY_STATUS.ARCHIVED,
							}}
							edit={{
								enabled: true,
								onClick: () => handleEdit(row),
							}}
						/>
					);
				},
			},
		],
		[],
	);

	return (
		<Page
			heading='Features'
			headingCTA={
				<div className='flex justify-between items-center gap-2'>
					<Link to={RouteNames.createFeature}>
						<AddButton />
					</Link>
				</div>
			}>
			<ApiDocsContent tags={['Features']} />
			<QueryableDataArea<Feature>
				queryConfig={{
					filterOptions,
					sortOptions: sortingOptions,
					initialFilters,
					initialSorts,
					debounceTime: 500,
				}}
				dataConfig={{
					queryKey: 'fetchFeatures',
					fetchFn: async (params) => FeatureApi.getFeaturesByFilter(params),
					probeFetchFn: async (params) =>
						FeatureApi.getFeaturesByFilter({
							...params,
							limit: 1,
							offset: 0,
							filters: [],
							sort: [],
						}),
				}}
				tableConfig={{
					columns,
					onRowClick: (row) => {
						navigate(RouteNames.featureDetails + `/${row?.id}`);
					},
					showEmptyRow: true,
				}}
				paginationConfig={{
					unit: 'Features',
				}}
				emptyStateConfig={{
					heading: 'Features',
					description: 'Create your first feature to define what customers pay for.',
					buttonLabel: 'Create Feature',
					buttonAction: () => navigate(RouteNames.createFeature),
					tags: ['Features'],
					tutorials: GUIDES.features.tutorials,
				}}
			/>
			{selectedFeature && (
				<FeatureDrawer data={selectedFeature} open={isDrawerOpen} onOpenChange={setIsDrawerOpen} refetchQueryKeys={['fetchFeatures']} />
			)}
		</Page>
	);
};
export default FeaturesPage;
