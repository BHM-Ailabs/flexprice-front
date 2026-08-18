import React, { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Input, Select, Button } from '@/components/atoms';
import { ENVIRONMENT_TYPE } from '@/models/Environment';
import { CreateEnvironmentPayload } from '@/types/dto/Environment';
import EnvironmentApi from '@/api/EnvironmentApi';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { SANDBOX_AUTO_CANCELLATION_DAYS } from '@/constants/constants';

interface Props {
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
	onEnvironmentCreated: (environmentId?: string) => void | Promise<void>;
}

const EnvironmentCreator: React.FC<Props> = ({ isOpen, onOpenChange, onEnvironmentCreated }) => {
	const [name, setName] = useState('Sandbox');
	const [type, setType] = useState<ENVIRONMENT_TYPE>(ENVIRONMENT_TYPE.DEVELOPMENT);
	const queryClient = useQueryClient();

	const environmentTypeOptions = useMemo(
		() => [
			{
				value: ENVIRONMENT_TYPE.DEVELOPMENT,
				label: 'Sandbox',
				description: 'For development and testing purposes',
			},
			{
				value: ENVIRONMENT_TYPE.PRODUCTION,
				label: 'Production',
				description: 'For live production environment',
			},
		],
		[],
	);

	const { mutate: createEnvironment, isPending } = useMutation({
		mutationFn: async (payload: CreateEnvironmentPayload) => {
			const result = await EnvironmentApi.createEnvironment(payload);
			if (!result) {
				throw new Error('Failed to create environment');
			}
			return result;
		},
		onSuccess: async (result) => {
			toast.success('Environment created successfully');
			// Reset form
			setName('Sandbox');
			setType(ENVIRONMENT_TYPE.DEVELOPMENT);
			// Close dialog
			onOpenChange(false);
			// Invalidate environments query to refetch the list
			queryClient.invalidateQueries({ queryKey: ['environments'] });
			// Call callback with the created environment ID (await if it's async)
			await onEnvironmentCreated(result?.id);
		},
		onError: (error: ServerError) => {
			// Extract descriptive error message from backend response
			// Backend returns: { success: false, error: { message: "...", internal_error: "..." } }
			const errorMessage = error?.error?.message || 'Failed to create environment';
			toast.error(errorMessage);
		},
	});

	const handleCreate = useCallback(() => {
		if (!name.trim()) {
			toast.error('Environment name is required');
			return;
		}

		createEnvironment({
			name: name.trim(),
			type,
		});
	}, [name, type, createEnvironment]);

	const handleCancel = useCallback(() => {
		setName('Sandbox');
		setType(ENVIRONMENT_TYPE.DEVELOPMENT);
		onOpenChange(false);
	}, [onOpenChange]);

	const isProduction = type === ENVIRONMENT_TYPE.PRODUCTION;
	const isSandbox = type === ENVIRONMENT_TYPE.DEVELOPMENT;

	const handleTypeChange = useCallback((value: string) => {
		const nextType = value as ENVIRONMENT_TYPE;
		setType(nextType);
		setName((currentName) => {
			if (currentName.trim() && currentName !== 'Sandbox' && currentName !== 'Production') {
				return currentName;
			}
			return nextType === ENVIRONMENT_TYPE.PRODUCTION ? 'Production' : 'Sandbox';
		});
	}, []);

	return (
		<Dialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title='Create Environment'
			className='max-w-[550px]'
			description='Create a new environment for your application'>
			<div className='space-y-4'>
				<Input label='Name' placeholder='Enter environment name' value={name} onChange={setName} disabled={isPending} />

				<Select
					label='Type'
					placeholder='Select environment type'
					options={environmentTypeOptions}
					value={type}
					onChange={handleTypeChange}
					disabled={isPending}
				/>

				{/* Sandbox Note */}
				{isSandbox && (
					<div className='w-full flex items-center gap-2.5 rounded-md border border-amber-300 bg-amber-50/80 px-3 py-2.5'>
						<AlertTriangle className='h-4 w-4 flex-shrink-0 text-amber-600' />
						<span className='text-sm font-medium text-amber-800 leading-relaxed'>
							Sandbox subscriptions are automatically cancelled after {SANDBOX_AUTO_CANCELLATION_DAYS} days
						</span>
					</div>
				)}

				{/* Production Warning */}
				{isProduction && (
					<div className='w-full flex items-center gap-2.5 rounded-md border border-amber-300 bg-amber-50/80 px-3 py-2.5'>
						<AlertTriangle className='h-4 w-4 flex-shrink-0 text-amber-600' />
						<span className='text-sm font-medium text-amber-800 leading-relaxed'>
							Production environments process live billing data. Review plans and prices before connecting customers.
						</span>
					</div>
				)}

				<div className='flex justify-end space-x-2 pt-4'>
					<Button variant='outline' onClick={handleCancel} disabled={isPending}>
						Cancel
					</Button>
					<Button onClick={handleCreate} disabled={isPending || !name.trim()}>
						{isPending ? 'Creating...' : 'Create Environment'}
					</Button>
				</div>
			</div>
		</Dialog>
	);
};

export default EnvironmentCreator;
