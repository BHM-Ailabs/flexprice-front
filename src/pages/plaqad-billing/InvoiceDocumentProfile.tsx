import { FormEvent, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Dialog } from '@/components/atoms';
import { billingGet, billingPut, type InvoiceDocumentProfile as Profile } from '@/api/PlaqadBillingApi';
import { ErrorNotice, Field, fieldClass } from './shared';

export default function InvoiceDocumentProfile() {
	const [open, setOpen] = useState(false);
	const query = useQuery({
		queryKey: ['plaqad-invoice-profile'],
		queryFn: () => billingGet<{ profile: Profile }>('/document-profile'),
		enabled: open,
		refetchOnWindowFocus: false,
	});
	return (
		<>
			<Button variant='outline' onClick={() => setOpen(true)}>
				Plaqad invoice details
			</Button>
			<Dialog
				isOpen={open}
				onOpenChange={setOpen}
				title='Plaqad invoice details'
				description='The issuer details for future invoices. Existing invoice snapshots keep their original details.'
				className='max-w-xl'>
				<ErrorNotice error={query.error} retry={() => void query.refetch()} />
				{query.isFetching ? (
					<p>Loading invoice details…</p>
				) : (
					query.data?.profile && (
						<ProfileForm
							profile={query.data.profile}
							done={() => {
								void query.refetch();
								setOpen(false);
							}}
						/>
					)
				)}
			</Dialog>
		</>
	);
}
function ProfileForm({ profile, done }: { profile: Profile; done: () => void }) {
	const [value, setValue] = useState(profile);
	const save = useMutation({
		mutationFn: () => billingPut('/document-profile', { ...value, displayName: 'Plaqad', website: 'https://plaqad.com' }),
		onSuccess: done,
	});
	const fields = [
		{ key: 'address', label: 'Issuer address', max: 1000 },
		{ key: 'email', label: 'Billing contact email', max: 320 },
		{ key: 'phone', label: 'Billing contact phone', max: 80 },
		{ key: 'registrationId', label: 'Registration number', max: 160 },
		{ key: 'taxId', label: 'Tax identification number', max: 160 },
	] as const;
	function submit(event: FormEvent) {
		event.preventDefault();
		save.mutate();
	}
	return (
		<form onSubmit={submit} className='space-y-4'>
			<p className='text-sm'>Plaqad · https://plaqad.com</p>
			<p className='text-xs text-zinc-500'>
				Only enter verified business details. Optional fields left empty will be omitted from future invoices.
			</p>
			{fields.map((field) => (
				<Field key={field.key} label={field.label}>
					{field.key === 'address' ? (
						<textarea
							className={fieldClass}
							rows={3}
							maxLength={field.max}
							value={value.address ?? ''}
							onChange={(e) => setValue({ ...value, address: e.target.value })}
						/>
					) : (
						<input
							className={fieldClass}
							type={field.key === 'email' ? 'email' : 'text'}
							maxLength={field.max}
							value={value[field.key] ?? ''}
							onChange={(e) => setValue({ ...value, [field.key]: e.target.value })}
						/>
					)}
				</Field>
			))}
			<ErrorNotice error={save.error} />
			<div className='flex justify-end gap-2'>
				<Button type='button' variant='outline' disabled={save.isPending} onClick={done}>
					Cancel
				</Button>
				<Button type='submit' variant='black' isLoading={save.isPending}>
					Save invoice details
				</Button>
			</div>
		</form>
	);
}
