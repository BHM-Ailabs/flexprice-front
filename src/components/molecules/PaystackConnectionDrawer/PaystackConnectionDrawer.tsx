import { FC, useEffect, useState } from 'react';
import { Button, Input, Sheet, Spacer } from '@/components/atoms';
import { useUser } from '@/hooks/UserContext';
import { useEnvironment } from '@/hooks/useEnvironment';
import { useMutation } from '@tanstack/react-query';
import ConnectionApi from '@/api/ConnectionApi';
import toast from 'react-hot-toast';
import { CheckCircle, Copy } from 'lucide-react';
import { CONNECTION_PROVIDER_TYPE } from '@/models';

interface PaystackConnectionDrawerProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	connection?: any;
	onSave: (connection: any) => void;
}

interface PaystackFormData {
	name: string;
	public_key: string;
	secret_key: string;
}

const emptyForm: PaystackFormData = {
	name: '',
	public_key: '',
	secret_key: '',
};

const PaystackConnectionDrawer: FC<PaystackConnectionDrawerProps> = ({ isOpen, onOpenChange, connection, onSave }) => {
	const { user } = useUser();
	const { activeEnvironment } = useEnvironment();
	const [formData, setFormData] = useState<PaystackFormData>(emptyForm);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [webhookCopied, setWebhookCopied] = useState(false);

	const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/v1';
	const webhookUrl =
		user?.tenant?.id && activeEnvironment?.id ? `${apiUrl}/webhooks/paystack/${user.tenant.id}/${activeEnvironment.id}` : '';

	useEffect(() => {
		if (!isOpen) return;
		setFormData(
			connection
				? {
						name: connection.name || '',
						public_key: '',
						secret_key: '',
					}
				: emptyForm,
		);
		setErrors({});
		setWebhookCopied(false);
	}, [isOpen, connection]);

	const handleChange = (field: keyof PaystackFormData, value: string) => {
		setFormData((previous) => ({ ...previous, [field]: value }));
		setErrors((previous) => ({ ...previous, [field]: '' }));
	};

	const validateForm = () => {
		const nextErrors: Record<string, string> = {};
		if (!formData.name.trim()) nextErrors.name = 'Connection name is required';
		if (!connection && !formData.secret_key.trim()) nextErrors.secret_key = 'Secret key is required';
		setErrors(nextErrors);
		return Object.keys(nextErrors).length === 0;
	};

	const { mutate: createConnection, isPending: isCreating } = useMutation({
		mutationFn: () =>
			ConnectionApi.Create({
				name: formData.name.trim(),
				provider_type: CONNECTION_PROVIDER_TYPE.PAYSTACK,
				encrypted_secret_data: {
					provider_type: CONNECTION_PROVIDER_TYPE.PAYSTACK,
					public_key: formData.public_key.trim() || undefined,
					secret_key: formData.secret_key.trim(),
				},
			}),
		onSuccess: (response) => {
			toast.success('Paystack connection created successfully');
			onSave(response);
			onOpenChange(false);
		},
		onError: (error: any) => toast.error(error?.message || 'Failed to create Paystack connection'),
	});

	const { mutate: updateConnection, isPending: isUpdating } = useMutation({
		mutationFn: () => {
			const payload: {
				name: string;
				encrypted_secret_data?: {
					provider_type: CONNECTION_PROVIDER_TYPE.PAYSTACK;
					public_key?: string;
					secret_key: string;
				};
			} = { name: formData.name.trim() };

			if (formData.secret_key.trim()) {
				payload.encrypted_secret_data = {
					provider_type: CONNECTION_PROVIDER_TYPE.PAYSTACK,
					public_key: formData.public_key.trim() || undefined,
					secret_key: formData.secret_key.trim(),
				};
			}

			return ConnectionApi.Update(connection.id, payload);
		},
		onSuccess: (response) => {
			toast.success('Paystack connection updated successfully');
			onSave(response);
			onOpenChange(false);
		},
		onError: (error: any) => toast.error(error?.message || 'Failed to update Paystack connection'),
	});

	const handleSave = () => {
		if (!validateForm()) return;
		if (connection) updateConnection();
		else createConnection();
	};

	const handleCopyWebhookUrl = async () => {
		if (!webhookUrl) return;
		await navigator.clipboard.writeText(webhookUrl);
		setWebhookCopied(true);
		toast.success('Paystack webhook URL copied');
		setTimeout(() => setWebhookCopied(false), 2000);
	};

	const isPending = isCreating || isUpdating;

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={connection ? 'Edit Paystack Connection' : 'Connect to Paystack'}
			description='Configure secure Paystack-hosted checkout and signed payment webhooks.'
			size='lg'>
			<div className='space-y-6 mt-4'>
				<Input
					label='Connection Name'
					placeholder='e.g., Plaqad Paystack Test'
					value={formData.name}
					onChange={(value) => handleChange('name', value)}
					error={errors.name}
					description='A friendly name to identify this Paystack connection'
				/>

				<Input
					label='Public Key (optional)'
					placeholder='pk_test_...'
					value={formData.public_key}
					onChange={(value) => handleChange('public_key', value)}
					description='Optional reference key; checkout initialization uses the secret key server-side'
				/>

				<Input
					label={connection ? 'Replace Secret Key (optional)' : 'Secret Key'}
					placeholder='sk_test_...'
					type='password'
					value={formData.secret_key}
					onChange={(value) => handleChange('secret_key', value)}
					error={errors.secret_key}
					description={
						connection
							? 'Leave blank to keep the current encrypted key'
							: 'Stored encrypted and used only by the FlexPrice backend to initialize and verify transactions'
					}
				/>

				<div className='p-4 bg-blue-50 border border-blue-200 rounded-lg'>
					<h3 className='text-sm font-medium text-blue-800 mb-2'>Webhook Configuration</h3>
					<p className='text-xs text-blue-700 mb-3'>
						Set this URL as the Paystack webhook endpoint. FlexPrice validates the x-paystack-signature header and verifies the transaction
						before recording success.
					</p>
					<div className='flex items-center gap-2 p-2 bg-white border border-blue-200 rounded-md'>
						<code className='flex-1 text-xs text-gray-800 font-mono break-all'>{webhookUrl}</code>
						<Button size='xs' variant='outline' onClick={handleCopyWebhookUrl} className='flex items-center gap-1'>
							{webhookCopied ? <CheckCircle className='w-3 h-3' /> : <Copy className='w-3 h-3' />}
							{webhookCopied ? 'Copied!' : 'Copy'}
						</Button>
					</div>
					<div className='mt-3 text-xs text-blue-700'>
						Event: <code className='font-mono'>charge.success</code>
					</div>
				</div>

				<Spacer className='!h-4' />
				<div className='flex gap-2'>
					<Button variant='outline' onClick={() => onOpenChange(false)} className='flex-1' disabled={isPending}>
						Cancel
					</Button>
					<Button onClick={handleSave} className='flex-1' isLoading={isPending} disabled={isPending}>
						{connection ? 'Update Connection' : 'Create Connection'}
					</Button>
				</div>
			</div>
		</Sheet>
	);
};

export default PaystackConnectionDrawer;
