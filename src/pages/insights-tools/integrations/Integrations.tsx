import { Loader, Page, Dialog, Card, Button, Divider } from '@/components/atoms';
import { Integration, integrations } from './integrationsData';
import { cn } from '@/lib/utils';
import { PremiumFeature, ApiDocsContent } from '@/components/molecules';
import { useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { ExternalLinkIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import ConnectionApi from '@/api/ConnectionApi';
import { CONNECTION_PROVIDER_TYPE } from '@/models/Connection';
import StripeConnectionDrawer from '@/components/molecules/StripeConnectionDrawer';
import RazorpayConnectionDrawer from '@/components/molecules/RazorpayConnectionDrawer';
import PaystackConnectionDrawer from '@/components/molecules/PaystackConnectionDrawer';
import ChargebeeConnectionDrawer from '@/components/molecules/ChargebeeConnectionDrawer';
import HubSpotConnectionDrawer from '@/components/molecules/HubSpotConnectionDrawer';
import QuickBooksConnectionDrawer from '@/components/molecules/QuickBooksConnectionDrawer/QuickBooksConnectionDrawer';
import ZohoBooksConnectionDrawer from '@/components/molecules/ZohoBooksConnectionDrawer/ZohoBooksConnectionDrawer';
import NomodConnectionDrawer from '@/components/molecules/NomodConnectionDrawer';
import MoyasarConnectionDrawer from '@/components/molecules/MoyasarConnectionDrawer';
import IntegrationDrawer from '@/components/molecules/IntegrationDrawer/IntegrationDrawer';

/** UI preview only: shows one card in connected state without real API data. Set to `null` to turn off. */
const PREVIEW_CONNECTED_PROVIDER: string | null = null;
const PREVIEW_MOCK_CONNECTION_ID = '__preview__';

/** API provider_type for List(); Zoho card uses name "Zoho" but backend expects zoho_books */
const getProviderTypeForIntegration = (integrationName: string): CONNECTION_PROVIDER_TYPE => {
	const n = integrationName.toLowerCase();
	return n === 'zoho' ? CONNECTION_PROVIDER_TYPE.ZOHO_BOOKS : (n as CONNECTION_PROVIDER_TYPE);
};

const Integrations = () => {
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null);
	const [editingConnection, setEditingConnection] = useState<any | null>(null);

	const availableIntegrations = integrations.filter((i) => !i.premium && i.type === 'available');

	const connectionQueries = useQueries({
		queries: availableIntegrations.map((integration) => {
			const listKey = integration.name.toLowerCase();
			const providerType = getProviderTypeForIntegration(integration.name);
			return {
				queryKey: ['connections', listKey],
				queryFn: () => ConnectionApi.List({ provider_type: providerType }),
			};
		}),
	});

	const connectionByProvider = new Map<string, any[]>();
	for (let idx = 0; idx < availableIntegrations.length; idx++) {
		const integration = availableIntegrations[idx];
		const listKey = integration.name.toLowerCase();
		const q = connectionQueries[idx];
		connectionByProvider.set(listKey, q?.data?.connections ?? []);
	}

	const isLoading = connectionQueries.some((q) => q.isLoading);

	const hasConnection = (integration: Integration) => {
		if (integration.premium) return false;
		const provider = integration.name.toLowerCase();
		return (connectionByProvider.get(provider) ?? []).length > 0;
	};

	const availableNonPremium = integrations.filter(
		(integration) => integration.type === 'available' && !integration.premium && !integration.tags.includes('Data Pipelines'),
	);

	const availablePremium = integrations.filter(
		(integration) => integration.type === 'available' && integration.premium && !integration.tags.includes('Data Pipelines'),
	);
	const previewProvider = PREVIEW_CONNECTED_PROVIDER ?? '';

	if (isLoading) {
		return <Loader />;
	}

	return (
		<Page heading='Integrations'>
			<ApiDocsContent tags={['Integrations', 'secrets']} />
			<div className='mt-6'>
				<h2 className='mb-4 font-medium text-xl'>Available</h2>
				<div className='grid grid-cols-2 gap-4'>
					{availableNonPremium.map((integration, index) => {
						const previewConnected = !!PREVIEW_CONNECTED_PROVIDER && integration.name.toLowerCase() === previewProvider.toLowerCase();
						const connected = hasConnection(integration) || previewConnected;
						const connection =
							connectionByProvider.get(integration.name.toLowerCase())?.[0] ??
							(previewConnected ? { id: PREVIEW_MOCK_CONNECTION_ID, name: 'Preview connection' } : null);
						return (
							<div key={`${integration.name}-${index}`} className='min-w-0'>
								<IntegrationCard
									integration={integration}
									connected={connected}
									connection={connection}
									isPreviewConnection={connection?.id === PREVIEW_MOCK_CONNECTION_ID}
									onOpenDrawer={(mode) => {
										setActiveIntegration(integration);
										setEditingConnection(mode === 'edit' ? (connectionByProvider.get(integration.name.toLowerCase())?.[0] ?? null) : null);
										setIsDrawerOpen(true);
									}}
									onDeleted={() => {
										connectionQueries.forEach((q) => q.refetch?.());
									}}
								/>
							</div>
						);
					})}
				</div>
			</div>
			<div className='mt-16'>
				<p className='mb-4 font-medium text-xl'>Premium add-ons</p>
				<div className='grid grid-cols-2 gap-4'>
					{availablePremium.map((integration, index) => (
						<div key={`${integration.name}-${index}`} className='min-w-0'>
							<IntegrationCard integration={integration} connected={false} connection={null} />
						</div>
					))}
				</div>
			</div>

			{/* Provider drawer rendered on this page */}
			{activeIntegration && (
				<>
					{activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.STRIPE ? (
						<StripeConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.PAYSTACK ? (
						<PaystackConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.RAZORPAY ? (
						<RazorpayConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.CHARGEBEE ? (
						<ChargebeeConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.HUBSPOT ? (
						<HubSpotConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.QUICKBOOKS ? (
						<QuickBooksConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : getProviderTypeForIntegration(activeIntegration.name) === CONNECTION_PROVIDER_TYPE.ZOHO_BOOKS ? (
						<ZohoBooksConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.NOMOD ? (
						<NomodConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : activeIntegration.name.toLowerCase() === CONNECTION_PROVIDER_TYPE.MOYASAR ? (
						<MoyasarConnectionDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					) : (
						<IntegrationDrawer
							isOpen={isDrawerOpen}
							onOpenChange={(open) => {
								setIsDrawerOpen(open);
								if (!open) {
									setEditingConnection(null);
									setActiveIntegration(null);
								}
							}}
							provider={activeIntegration.name.toLowerCase()}
							providerName={activeIntegration.name}
							connection={editingConnection}
							onSave={() => {
								connectionQueries.forEach((q) => q.refetch?.());
								setIsDrawerOpen(false);
								setEditingConnection(null);
								setActiveIntegration(null);
							}}
						/>
					)}
				</>
			)}
		</Page>
	);
};

type IntegrationCardProps = {
	integration: Integration;
	connected: boolean;
	connection: any | null;
	/** Mock connection used only for UI preview */
	isPreviewConnection?: boolean;
	onOpenDrawer?: (mode?: 'edit' | 'create') => void;
	onDeleted?: () => void;
};

const IntegrationCard = ({ integration, connected, connection, isPreviewConnection, onOpenDrawer, onDeleted }: IntegrationCardProps) => {
	const queryClient = useQueryClient();
	const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

	const providerKey = integration.name.toLowerCase();

	const { mutate: deleteConnection, isPending: isDeletingConnection } = useMutation({
		mutationFn: (id: string) => ConnectionApi.Delete(id),
		onSuccess: () => {
			toast.success(`${integration.name} disconnected`);
			queryClient.invalidateQueries({ queryKey: ['connections', providerKey] });
			setDisconnectDialogOpen(false);
			onDeleted?.();
		},
		onError: (err: Error) => {
			toast.error(err?.message ?? 'Failed to disconnect');
		},
	});

	const handleToggle = (checked: boolean) => {
		if (integration.premium) return;
		if (checked) {
			// Open create drawer
			onOpenDrawer?.('create');
		} else {
			setDisconnectDialogOpen(true);
		}
	};

	const handleConfirmDisconnect = () => {
		if (!connection?.id) return;
		if (connection.id === PREVIEW_MOCK_CONNECTION_ID) {
			toast.success('Preview only — this is a mock connected state.');
			setDisconnectDialogOpen(false);
			return;
		}
		deleteConnection(connection.id);
	};

	return (
		<PremiumFeature isPremiumFeature={integration.premium}>
			<Card className={cn('min-w-0 overflow-hidden border-slate-200 shadow-sm rounded-xl')} noPadding>
				<div className='min-w-0 overflow-hidden p-6'>
					<div className='flex gap-5'>
						<div className='flex size-14 shrink-0 items-center justify-center rounded-lg bg-slate-100'>
							<img src={integration.logo} alt={integration.name} className='size-8 object-contain' />
						</div>
						<div className='min-w-0 flex-1 space-y-2'>
							<div className='flex items-center gap-2'>
								<h3 className='font-semibold text-lg text-foreground'>{integration.name}</h3>
								{connected && (
									<span className='inline-flex h-5 items-center rounded-sm bg-emerald-100 px-2 text-xs font-medium text-emerald-700'>
										Connected
									</span>
								)}
								{integration.premium && (
									<span className='inline-flex h-5 items-center rounded-sm bg-amber-100 px-2 text-xs font-medium text-amber-700'>
										Premium
									</span>
								)}
								<div className='ml-auto'>
									{integration.docsUrl ? (
										<a
											href={integration.docsUrl}
											target='_blank'
											rel='noopener noreferrer'
											className='inline-flex h-5 items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-700'
											title={`Open ${integration.name} docs`}>
											Docs
											<ExternalLinkIcon className='size-3.5' />
										</a>
									) : null}
								</div>
							</div>
							<div className='min-w-0 overflow-hidden'>
								<p className='text-sm text-slate-500 line-clamp-2 break-words'>{integration.description}</p>
							</div>
							{integration.tags.length > 0 && (
								<div className='flex flex-wrap gap-1.5 pt-1'>
									{integration.tags.slice(0, 3).map((tag, idx) => (
										<span key={idx} className='text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm'>
											{tag}
										</span>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
				<Divider color='#f1f5f9' className='w-full' />
				<div className='flex flex-row items-center justify-between px-6 py-4'>
					<div className='flex items-center gap-2'>
						{connected ? (
							<>
								<Button
									type='button'
									variant='outline'
									size='icon'
									className='h-8 w-8'
									onClick={() => onOpenDrawer?.('edit')}
									disabled={integration.premium || isPreviewConnection}>
									<PencilIcon className='size-4' />
								</Button>
								<Button
									type='button'
									variant='outline'
									size='icon'
									className='h-8 w-8'
									onClick={() => setDisconnectDialogOpen(true)}
									disabled={integration.premium}>
									<TrashIcon className='size-4' />
								</Button>
							</>
						) : null}
					</div>
					<Switch
						checked={connected}
						onCheckedChange={handleToggle}
						disabled={integration.premium}
						className={cn(
							'data-[state=unchecked]:bg-slate-800',
							'data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500',
						)}
					/>
				</div>
			</Card>

			<Dialog
				isOpen={disconnectDialogOpen}
				onOpenChange={setDisconnectDialogOpen}
				title={`Disconnect ${integration.name}?`}
				description='This will remove the connection. You can reconnect from the integrations page at any time.'
				descriptionClassName='mt-2'>
				<div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2'>
					<Button variant='outline' onClick={() => setDisconnectDialogOpen(false)} disabled={isDeletingConnection}>
						Cancel
					</Button>
					<Button variant='destructive' onClick={handleConfirmDisconnect} disabled={isDeletingConnection || !connection?.id}>
						{isDeletingConnection ? 'Disconnecting…' : 'Disconnect'}
					</Button>
				</div>
			</Dialog>
		</PremiumFeature>
	);
};

export default Integrations;
