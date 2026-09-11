import { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Page, Button } from '@/components/atoms';

export const fieldClass =
	'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 disabled:bg-zinc-100';
export const tableClass =
	'w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:px-3 [&_th]:py-3 [&_th]:font-medium [&_th]:text-zinc-500 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_tbody_tr]:border-t [&_tbody_tr]:border-zinc-100';
export const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
export const date = (value: string | null) => (value ? new Date(value).toLocaleString() : '—');
export function message(error: unknown): string {
	return error instanceof Error ? error.message : 'Unable to complete the request. Try again.';
}

export function BillingPage({
	title,
	description,
	children,
	invoiceOnly = false,
}: {
	title: string;
	description: string;
	children: ReactNode;
	invoiceOnly?: boolean;
}) {
	return (
		<Page heading={title} className='!max-w-screen-xl px-4 sm:px-6'>
			<p className='mb-5 max-w-3xl text-sm leading-6 text-zinc-600'>{description}</p>
			<nav aria-label='Plaqad suite billing' className='mb-5 flex flex-wrap gap-2 border-b border-zinc-200 pb-3'>
				{[
					['/billing/prepaid-invoices', 'Prepaid invoices'],
					['/billing/plaqad-pricing', 'Usage markup'],
					['/billing/plaqad-usage', 'User usage'],
					['/billing/workspace-credits', 'Workspace credits'],
				]
					.filter(([path]) => !invoiceOnly || path === '/billing/prepaid-invoices')
					.map(([path, name]) => (
						<NavLink
							key={path}
							to={path}
							className={({ isActive }) =>
								`rounded-md px-3 py-2 text-sm ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`
							}>
							{name}
						</NavLink>
					))}
			</nav>
			<p className='mb-6 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-600'>
				These controls manage the live Plaqad suite. The BSP environment selector does not change their scope.
			</p>
			{children}
		</Page>
	);
}
export function Field({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
	return (
		<label className='flex min-w-0 flex-col gap-2 text-sm font-medium text-zinc-800'>
			<span>{label}</span>
			{children}
			{help && <span className='text-xs font-normal leading-5 text-zinc-500'>{help}</span>}
		</label>
	);
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
	if (!error) return null;
	return (
		<div role='alert' className='my-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900'>
			<p>{message(error)}</p>
			{retry && (
				<Button type='button' variant='outline' className='mt-3' onClick={retry}>
					Try again
				</Button>
			)}
		</div>
	);
}
export function Panel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className='mb-6 rounded-lg border border-zinc-200 bg-white'>
			<h2 className='border-b border-zinc-100 px-5 py-4 text-base font-medium'>{title}</h2>
			<div className='p-5'>{children}</div>
		</section>
	);
}
