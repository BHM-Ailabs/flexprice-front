import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from '@/components/ui';
import React from 'react';
import SidebarNav, { NavItem } from './SidebarMenu';
import FlexpriceSidebarFooter from './SidebarFooter';
import { RouteNames } from '@/core/routes/Routes';
import { EnvironmentSelector } from '@/components/molecules';
import { Settings, Landmark, Layers2, CodeXml, Puzzle, GalleryHorizontalEnd, Home, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAQAD_AUTH_ENABLED } from '@/core/auth/PlaqadAuth';

const AppSidebar: React.FC<React.ComponentProps<typeof Sidebar>> = ({ ...props }) => {
	const { open: sidebarOpen } = useSidebar();
	const navMain: NavItem[] = [
		{
			title: 'Home',
			url: RouteNames.homeDashboard,
			icon: Home,
		},
		{
			title: 'Product Catalog',
			url: RouteNames.features,
			icon: Layers2,
			items: [
				{
					title: 'Features',
					url: RouteNames.features,
				},
				{
					title: 'Plans',
					url: RouteNames.plan,
				},
				{
					title: 'Coupons',
					url: RouteNames.coupons,
				},
				{
					title: 'Addons',
					url: RouteNames.addons,
				},
				{
					title: 'Cost Sheets',
					url: RouteNames.costSheets,
				},
				{
					title: 'Price Units',
					url: RouteNames.priceUnits,
				},
				{
					title: 'Groups',
					url: RouteNames.groups,
				},
			],
		},
		{
			title: 'Billing',
			url: RouteNames.customers,
			icon: Landmark,
			items: [
				...(PLAQAD_AUTH_ENABLED ? [{ title: 'Prepaid invoices', url: RouteNames.prepaidInvoices }] : []),
				{
					title: 'Customers',
					url: RouteNames.customers,
				},
				{
					title: 'Subscriptions',
					url: RouteNames.subscriptions,
				},
				{
					title: 'Taxes',
					url: RouteNames.taxes,
				},
				{
					title: 'Invoices',
					url: RouteNames.invoices,
				},
				{
					title: 'Credit Notes',
					url: RouteNames.creditNotes,
				},
				{
					title: 'Payments',
					url: RouteNames.payments,
				},
			],
		},
		{
			title: 'Revenue',
			url: RouteNames.revenue,
			icon: BarChart3,
		},

		{
			title: 'Tools',
			url: RouteNames.bulkImports,
			icon: Settings,
			items: [
				{
					title: 'Imports',
					url: RouteNames.bulkImports,
				},
				{
					title: 'Exports',
					url: RouteNames.exports,
				},
			],
		},
		{
			title: 'Developers',
			url: RouteNames.events,
			icon: CodeXml,
			items: [
				{
					title: 'Events Debugger',
					url: RouteNames.events,
				},
				{
					title: 'API Keys',
					url: RouteNames.apiKeys,
				},
				{
					title: 'Service Accounts',
					url: RouteNames.serviceAccounts,
				},
				{
					title: 'Webhooks',
					url: RouteNames.webhooks,
				},
				{
					title: 'Workflows',
					url: RouteNames.workflows,
				},
			],
		},
		{
			title: 'Integrations',
			url: RouteNames.integrations,
			icon: Puzzle,
		},
		{
			title: 'Pricing Widget',
			url: RouteNames.pricing,
			icon: GalleryHorizontalEnd,
		},
	];
	return (
		<Sidebar
			collapsible='icon'
			{...props}
			className={cn('border-r-[1.5px] border-gray-300 py-1 bg-[#f9f9f9]', sidebarOpen ? 'px-3' : 'px-2')}>
			<SidebarHeader>
				<EnvironmentSelector />
			</SidebarHeader>
			<SidebarContent className='gap-0 mt-1'>
				<SidebarNav items={navMain} />
			</SidebarContent>
			<SidebarFooter>
				<FlexpriceSidebarFooter />
			</SidebarFooter>
		</Sidebar>
	);
};

export default AppSidebar;
