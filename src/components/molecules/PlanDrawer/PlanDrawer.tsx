import { Button, Input, Sheet, Spacer, Textarea } from '@/components/atoms';
import { Plan } from '@/models/Plan';
import { FC, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PlanApi } from '@/api/PlanApi';
import toast from 'react-hot-toast';
import { queryClient, refetchQueries } from '@/core/services/tanstack/ReactQueryProvider';
import { SIDEBAR_PRICING_PROMO_QUERY_KEY } from '@/hooks/useShouldShowSidebarPricingPromo';
import { useNavigate } from 'react-router';
import { RouteNames } from '@/core/routes/Routes';
import { CreatePlanRequest, UpdatePlanRequest, PlanResponse, CreatePlanResponse } from '@/types/dto';
import { PlanMetadataField, PlanMetadataFieldsSection, WebsitePublishingSection } from '@/components/organisms/PlanForm';
import {
	applyCustomPlanMetadataFields,
	customPlanMetadataFieldsFromMetadata,
	hasPlanMetadataFieldErrors,
	PlanMetadataFieldError,
	validatePlanMetadataFields,
} from '@/lib/planMetadataFields';
interface Props {
	data?: Plan | null;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	trigger?: React.ReactNode;
	refetchQueryKeys?: string | string[];
}

const PlanDrawer: FC<Props> = ({ data, open, onOpenChange, trigger, refetchQueryKeys }) => {
	const isEdit = !!data;
	const navigate = useNavigate();

	const [formData, setFormData] = useState<CreatePlanRequest & { id?: string }>({
		name: data?.name || '',
		description: data?.description || '',
		lookup_key: data?.lookup_key || '',
		metadata: data?.metadata,
		id: data?.id,
	});
	const [metadataFieldSequence, setMetadataFieldSequence] = useState(0);
	const [metadataFields, setMetadataFields] = useState<PlanMetadataField[]>(() =>
		customPlanMetadataFieldsFromMetadata(data?.metadata).map((field, index) => ({ ...field, id: `metadata-field-${index}` })),
	);
	const [metadataFieldErrors, setMetadataFieldErrors] = useState<PlanMetadataFieldError[]>([]);
	const [errors, setErrors] = useState<Partial<Record<keyof CreatePlanRequest, string>>>({});

	const { mutate: updatePlan, isPending } = useMutation<
		PlanResponse | CreatePlanResponse,
		ServerError,
		CreatePlanRequest | (UpdatePlanRequest & { id: string })
	>({
		mutationFn: (vars) => {
			if (isEdit) {
				const { id, ...rest } = vars as UpdatePlanRequest & { id: string };
				return PlanApi.updatePlan(id, rest);
			}
			return PlanApi.createPlan(vars as CreatePlanRequest);
		},
		onSuccess: (data) => {
			toast.success(isEdit ? 'Plan updated successfully' : 'Plan created successfully');
			onOpenChange?.(false);
			refetchQueries(refetchQueryKeys);
			void queryClient.invalidateQueries({ queryKey: [SIDEBAR_PRICING_PROMO_QUERY_KEY], exact: false });
			navigate(`${RouteNames.plan}/${data.id}`);
		},
		onError: (error: ServerError) => {
			toast.error(error.error.message || `Failed to ${isEdit ? 'update' : 'create'} plan. Please try again.`);
		},
	});

	useEffect(() => {
		if (data) {
			// Map Plan to CreatePlanRequest structure for form
			setFormData({
				id: data.id,
				name: data.name || '',
				description: data.description || '',
				lookup_key: data.lookup_key || '',
				metadata: data.metadata,
			});
			const fields = customPlanMetadataFieldsFromMetadata(data.metadata).map((field, index) => ({
				...field,
				id: `metadata-field-${index}`,
			}));
			setMetadataFields(fields);
			setMetadataFieldSequence(fields.length);
		} else {
			setFormData({
				name: '',
				description: '',
				lookup_key: '',
			});
			setMetadataFields([]);
			setMetadataFieldSequence(0);
		}
		setMetadataFieldErrors([]);
		setErrors({});
	}, [data, open]);

	// Auto-generate lookup key from name when creating (not editing)
	useEffect(() => {
		if (!isEdit) {
			setFormData((prev) => ({ ...prev, lookup_key: `plan-${prev.name?.toLowerCase().replace(/\s/g, '-') || ''}` }));
		}
	}, [formData.name, isEdit]);

	const validateForm = () => {
		const newErrors: Partial<Record<keyof CreatePlanRequest, string>> = {};

		if (!formData.name?.trim()) {
			newErrors.name = 'Name is required';
		}

		if (!formData.lookup_key?.trim()) {
			newErrors.lookup_key = 'Lookup key is required';
		}

		const nextMetadataFieldErrors = validatePlanMetadataFields(metadataFields);
		setMetadataFieldErrors(nextMetadataFieldErrors);

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0 && !hasPlanMetadataFieldErrors(nextMetadataFieldErrors);
	};

	const handleStructuredMetadataChange = (metadata: NonNullable<CreatePlanRequest['metadata']>) => {
		setFormData((previous) => ({ ...previous, metadata }));
	};

	const handleSave = () => {
		if (!validateForm()) {
			return;
		}

		const metadata = applyCustomPlanMetadataFields(formData.metadata, metadataFields);

		if (isEdit) {
			const updateDto: UpdatePlanRequest & { id: string } = {
				id: formData.id!,
				name: formData.name.trim(),
				lookup_key: formData.lookup_key, // Optional - matches backend structure
				description: formData.description,
				metadata,
			};
			updatePlan(updateDto);
		} else {
			// Build CreatePlanRequest DTO
			const createDto: CreatePlanRequest = {
				name: formData.name.trim(),
				lookup_key: formData.lookup_key,
				description: formData.description,
				metadata,
			};
			updatePlan(createDto);
		}
	};

	return (
		<Sheet
			isOpen={open}
			onOpenChange={onOpenChange}
			size='lg'
			title={isEdit ? 'Edit Plan' : 'Create Plan'}
			description={isEdit ? 'Enter plan details to update the plan.' : 'Enter plan details to create a new plan.'}
			trigger={trigger}>
			<Spacer height={'20px'} />
			<Input
				placeholder='Enter a name for the plan'
				description={'A descriptive name for this pricing plan.'}
				label='Plan Name'
				value={formData.name}
				error={errors.name}
				onChange={(e) => {
					setFormData({ ...formData, name: e });
				}}
			/>

			<Spacer height={'20px'} />
			<Input
				label='Lookup Key'
				error={errors.lookup_key}
				onChange={(e) => {
					setFormData({ ...formData, lookup_key: e });
				}}
				value={formData.lookup_key}
				placeholder='Enter a slug for the plan'
				description={'A system identifier used for API calls and integrations.'}
			/>

			<Spacer height={'20px'} />
			<Textarea
				value={formData.description}
				onChange={(e) => {
					setFormData({ ...formData, description: e });
				}}
				className='min-h-[100px]'
				placeholder='Enter description'
				label='Description'
				description='Helps your team to understand the purpose of this plan.'
			/>

			<Spacer height={'20px'} />
			<WebsitePublishingSection metadata={formData.metadata} onChange={handleStructuredMetadataChange} />

			<Spacer height={'20px'} />
			<PlanMetadataFieldsSection
				fields={metadataFields}
				errors={metadataFieldErrors}
				onChange={(fields) => {
					setMetadataFields(fields);
					setMetadataFieldErrors([]);
				}}
				onAdd={() => {
					setMetadataFields((fields) => [...fields, { id: `metadata-field-${metadataFieldSequence}`, key: '', value: '' }]);
					setMetadataFieldSequence((sequence) => sequence + 1);
				}}
			/>

			<Spacer height={'20px'} />
			<Button isLoading={isPending} disabled={isPending || !formData.name?.trim() || !formData.lookup_key?.trim()} onClick={handleSave}>
				{isEdit ? 'Save' : 'Create'}
			</Button>
		</Sheet>
	);
};

export default PlanDrawer;
