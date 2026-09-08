import { FC, useState, useEffect } from 'react';
import { Button, Input, Sheet, Spacer } from '@/components/atoms';
import { Switch } from '@/components/ui';
import { useUser } from '@/hooks/UserContext';
import { useEnvironment } from '@/hooks/useEnvironment';
import { useMutation } from '@tanstack/react-query';
import ConnectionApi from '@/api/ConnectionApi';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '@/core/axios/types';
import { Copy, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import {
	StripeWebhookEvents,
	getDefaultWebhookEvents,
	getPlanWebhookEvents,
	getSubscriptionWebhookEvents,
	getInvoiceWebhookEvents,
} from '@/types';
import {
	buildStripeConnectionCreatePayload,
	expectedStripeMode,
	StripeConnectionFormData,
	validateStripeConnectionForm,
} from '@/lib/stripeConnectionForm';
import { Connection } from '@/models';

interface StripeConnectionEditValue extends Connection {
	sync_config?: {
		plan?: { inbound?: boolean };
		subscription?: { inbound?: boolean };
		invoice?: { outbound?: boolean };
	};
}

interface StripeConnectionDrawerProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	connection?: StripeConnectionEditValue | null;
	onSave: (connection: Connection) => void;
}

const StripeConnectionDrawer: FC<StripeConnectionDrawerProps> = ({ isOpen, onOpenChange, connection, onSave }) => {
	const { user } = useUser();
	const { activeEnvironment } = useEnvironment();

	const [formData, setFormData] = useState<StripeConnectionFormData>({
		name: '',
		publishable_key: '',
		secret_key: '',
		webhook_secret: '',
		sync_config: {
			plan: false, // pull from Stripe
			subscription: false, // pull from Stripe
			invoice: false, // push to Stripe
		},
	});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [webhookCopied, setWebhookCopied] = useState(false);
	const [isWebhookEventsExpanded, setIsWebhookEventsExpanded] = useState(false);

	// Generate webhook URL using environment variable
	const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/v1';
	const webhookUrl = user?.tenant?.id && activeEnvironment?.id ? `${apiUrl}/webhooks/stripe/${user.tenant.id}/${activeEnvironment.id}` : '';
	const stripeMode = expectedStripeMode(activeEnvironment?.type);

	// Webhook events mapping based on sync config
	const getWebhookEvents = (): StripeWebhookEvents[] => {
		const events: StripeWebhookEvents[] = [];

		// Default events (always included)
		events.push(...getDefaultWebhookEvents());

		// Plan events (pull from Stripe)
		if (formData.sync_config.plan) {
			events.push(...getPlanWebhookEvents());
		}

		// Subscription events (pull from Stripe)
		if (formData.sync_config.subscription) {
			events.push(...getSubscriptionWebhookEvents());
		}

		// Invoice events (push to Stripe)
		if (formData.sync_config.invoice) {
			events.push(...getInvoiceWebhookEvents());
		}

		return events;
	};

	// Reset form on open or when editing connection changes
	useEffect(() => {
		if (isOpen) {
			if (connection) {
				// Handle legacy format with inbound/outbound structure
				const legacySyncConfig = connection.sync_config;
				const newSyncConfig = {
					plan: legacySyncConfig?.plan?.inbound || false,
					subscription: legacySyncConfig?.subscription?.inbound || false,
					invoice: legacySyncConfig?.invoice?.outbound || false,
				};

				setFormData({
					name: connection.name || '',
					publishable_key: '',
					secret_key: '',
					webhook_secret: '',
					sync_config: newSyncConfig,
				});
			} else {
				setFormData({
					name: '',
					publishable_key: '',
					secret_key: '',
					webhook_secret: '',
					sync_config: {
						plan: false,
						subscription: false,
						invoice: false,
					},
				});
			}
			setErrors({});
			setWebhookCopied(false);
		}
	}, [isOpen, connection]);

	const handleChange = (field: keyof StripeConnectionFormData, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		setErrors((prev) => ({ ...prev, [field]: '' }));
	};

	const handleSyncConfigChange = (category: keyof typeof formData.sync_config, value: boolean) => {
		setFormData((prev) => ({
			...prev,
			sync_config: {
				...prev.sync_config,
				[category]: value,
			},
		}));
	};

	const validateForm = () => {
		const newErrors = validateStripeConnectionForm(formData, {
			requireCredentials: !connection,
			environmentType: activeEnvironment?.type,
		});

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const { mutate: createConnection, isPending: isCreating } = useMutation({
		mutationFn: async () => {
			return await ConnectionApi.Create(buildStripeConnectionCreatePayload(formData));
		},
		onSuccess: (response) => {
			toast.success('Stripe connection created successfully');
			onSave(response);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			toast.error(getApiErrorMessage(error, 'Failed to create Stripe connection. Check the credentials and try again.'));
		},
	});

	const { mutate: updateConnection, isPending: isUpdating } = useMutation({
		mutationFn: async () => {
			if (!connection) throw new Error('Stripe connection is required for an update.');
			const payload = {
				name: formData.name,
				sync_config: {
					plan: {
						inbound: formData.sync_config.plan,
						outbound: false,
					},
					subscription: {
						inbound: formData.sync_config.subscription,
						outbound: false,
					},
					invoice: {
						inbound: false,
						outbound: formData.sync_config.invoice,
					},
				},
			};

			return await ConnectionApi.Update(connection.id, payload);
		},
		onSuccess: (response) => {
			toast.success('Stripe connection updated successfully');
			onSave(response);
			onOpenChange(false);
		},
		onError: (error: unknown) => {
			toast.error(getApiErrorMessage(error, 'Failed to update Stripe connection. Please try again.'));
		},
	});

	const handleSave = () => {
		if (validateForm()) {
			if (connection) {
				updateConnection();
			} else {
				createConnection();
			}
		}
	};

	const isPending = isCreating || isUpdating;

	const handleCopyWebhookUrl = () => {
		if (webhookUrl) {
			navigator.clipboard.writeText(webhookUrl);
			setWebhookCopied(true);
			toast.success('Webhook URL copied to clipboard!');

			// Reset copy status after 2 seconds
			setTimeout(() => {
				setWebhookCopied(false);
			}, 2000);
		}
	};

	return (
		<Sheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={connection ? 'Edit Stripe Connection' : 'Connect to Stripe'}
			description='Configure your Stripe integration with the required credentials.'
			size='lg'>
			<div className='space-y-6 mt-9'>
				{/* Connection Name */}
				<Input
					id='stripe-connection-name'
					label='Connection Name'
					placeholder='e.g., Production Stripe'
					value={formData.name}
					onChange={(value) => handleChange('name', value)}
					error={errors.name}
					description='A friendly name that identifies the Stripe account and environment.'
				/>

				{/* Credentials */}
				{!connection && (
					<div className='space-y-4 rounded-[6px] border border-gray-200 p-4'>
						<div>
							<h3 className='text-sm font-medium text-gray-900'>Stripe API keys</h3>
							<p className='mt-1 text-xs text-gray-600'>
								This {activeEnvironment?.type ?? 'selected'} Plaqad BSP environment requires{' '}
								{stripeMode ? `${stripeMode}-mode` : 'matching'} keys.
							</p>
						</div>
						<Input
							id='stripe-publishable-key'
							label='Publishable key'
							placeholder={stripeMode === 'live' ? 'pk_live_...' : 'pk_test_...'}
							value={formData.publishable_key}
							onChange={(value) => handleChange('publishable_key', value)}
							error={errors.publishable_key}
							autoComplete='off'
							description='Copy the publishable key from Stripe Workbench. Its mode must match the server key below.'
						/>
						<Input
							id='stripe-server-key'
							label='Restricted or secret key'
							placeholder={stripeMode === 'live' ? 'rk_live_... or sk_live_...' : 'rk_test_... or sk_test_...'}
							type='password'
							value={formData.secret_key}
							onChange={(value) => handleChange('secret_key', value)}
							error={errors.secret_key}
							autoComplete='new-password'
							description='Prefer a restricted key (rk_) with only the permissions Plaqad BSP needs. This value is never shown again.'
						/>
					</div>
				)}

				{/* Sync Configuration Section */}
				<div className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
					<h3 className='text-sm font-medium text-gray-800 mb-3'>Sync Configuration</h3>
					<p className='text-xs text-gray-600 mb-4'>Configure what data to sync between Stripe and Plaqad BSP</p>

					<div className='space-y-4'>
						{/* Plans */}
						<div className='flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg'>
							<div>
								<label className='text-sm font-medium text-gray-700'>Plans</label>
								<p className='text-xs text-gray-500'>Pull from Stripe</p>
							</div>
							<Switch checked={formData.sync_config.plan} onCheckedChange={(checked) => handleSyncConfigChange('plan', checked)} />
						</div>

						{/* Invoices */}
						<div className='flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg'>
							<div>
								<label className='text-sm font-medium text-gray-700'>Invoices</label>
								<p className='text-xs text-gray-500'>Push to Stripe</p>
							</div>
							<Switch checked={formData.sync_config.invoice} onCheckedChange={(checked) => handleSyncConfigChange('invoice', checked)} />
						</div>

						{/* Subscriptions */}
						<div className='flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg'>
							<div>
								<label className='text-sm font-medium text-gray-700'>Subscriptions</label>
								<p className='text-xs text-gray-500'>Pull from Stripe</p>
							</div>
							<Switch
								checked={formData.sync_config.subscription}
								onCheckedChange={(checked) => handleSyncConfigChange('subscription', checked)}
							/>
						</div>
					</div>
				</div>

				{/* Webhook Section */}
				<div className='p-4 bg-blue-50 border border-blue-200 rounded-lg'>
					<h3 className='text-sm font-medium text-blue-800 mb-3'>Webhook Configuration</h3>

					{/* Webhook Secret */}
					{!connection && (
						<div className='mb-4'>
							<Input
								id='stripe-webhook-signing-secret'
								label='Webhook signing secret'
								placeholder='whsec_...'
								type='password'
								value={formData.webhook_secret}
								onChange={(value) => handleChange('webhook_secret', value)}
								error={errors.webhook_secret}
								autoComplete='new-password'
								description='Copy the whsec_ signing secret after creating this endpoint in Stripe. Plaqad BSP uses it to verify every event.'
							/>
						</div>
					)}

					{/* Webhook URL Block */}
					<div className='mb-4'>
						<label className='text-sm font-medium text-blue-800 mb-2 block'>Webhook URL</label>
						<p className='text-xs text-blue-700 mb-3'>Set up this webhook URL in your Stripe dashboard to receive event notifications:</p>
						<div className='flex items-center gap-2 p-2 bg-white border border-blue-200 rounded-md'>
							<code className='flex-1 text-xs text-gray-800 font-mono break-all'>{webhookUrl}</code>
							<Button size='xs' variant='outline' onClick={handleCopyWebhookUrl} className='flex items-center gap-1'>
								{webhookCopied ? <CheckCircle className='w-3 h-3' /> : <Copy className='w-3 h-3' />}
								{webhookCopied ? 'Copied!' : 'Copy'}
							</Button>
						</div>
					</div>

					{/* Webhook Events to Subscribe - Collapsible */}
					<div>
						<button
							type='button'
							onClick={() => setIsWebhookEventsExpanded(!isWebhookEventsExpanded)}
							className='flex items-center gap-2 text-sm font-medium text-blue-800 hover:text-blue-900 mb-2'>
							{isWebhookEventsExpanded ? <ChevronDown className='w-4 h-4' /> : <ChevronRight className='w-4 h-4' />}
							Webhook Events to Subscribe
						</button>

						{isWebhookEventsExpanded && (
							<div className='mt-2 p-3 bg-white border border-blue-200 rounded-md'>
								<p className='text-xs text-blue-700 mb-3'>
									Based on your sync configuration, subscribe to these events in your Stripe dashboard:
								</p>
								<div className='space-y-1'>
									{getWebhookEvents().map((event, index) => (
										<div key={index} className='flex items-center gap-2 text-xs text-blue-700'>
											<div className='w-1.5 h-1.5 bg-blue-500 rounded-full'></div>
											<code className='font-mono'>{event}</code>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				<Spacer className='!h-1' />

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

export default StripeConnectionDrawer;
