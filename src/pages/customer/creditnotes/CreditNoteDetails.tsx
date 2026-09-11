import { invoiceReference } from '@/utils/invoices/invoiceReference';
import { Spacer, Divider, Loader, Card, Page } from '@/components/atoms';
import { ApiDocsContent, CreditNoteLineItemTable } from '@/components/molecules';
import { useBreadcrumbsStore } from '@/store/useBreadcrumbsStore';
import CreditNoteApi from '@/api/CreditNoteApi';
import formatDate from '@/utils/common/format_date';
import { useQuery } from '@tanstack/react-query';
import { FC, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router';
import { RouteNames } from '@/core/routes/Routes';
import { CREDIT_NOTE_STATUS, CREDIT_NOTE_TYPE } from '@/types/dto';
import { Chip } from '@/components/atoms';
import { AlertCircle } from 'lucide-react';
import { getTypographyClass } from '@/lib/typography';

interface Props {
	credit_note_id: string;
	breadcrumb_index: number;
}

const getStatusChip = (status: CREDIT_NOTE_STATUS) => {
	switch (status) {
		case CREDIT_NOTE_STATUS.VOIDED:
			return <Chip variant='default' label='Voided' />;
		case CREDIT_NOTE_STATUS.FINALIZED:
			return <Chip variant='success' label='Finalized' />;
		case CREDIT_NOTE_STATUS.DRAFT:
			return <Chip variant='default' label='Draft' />;
		default:
			return <Chip variant='default' label='Draft' />;
	}
};

const getTypeChip = (type: CREDIT_NOTE_TYPE) => {
	switch (type) {
		case CREDIT_NOTE_TYPE.REFUND:
			return <Chip variant='default' label='Refund' />;
		case CREDIT_NOTE_TYPE.ADJUSTMENT:
			return <Chip variant='default' label='Adjustment' />;
		default:
			return <Chip variant='default' label='Unknown' />;
	}
};

const CreditNoteDetails: FC<Props> = ({ credit_note_id, breadcrumb_index }) => {
	const { updateBreadcrumb } = useBreadcrumbsStore();
	const { data, isLoading, isError } = useQuery({
		queryKey: ['fetchCreditNote', credit_note_id],
		queryFn: async () => {
			return await CreditNoteApi.getCreditNoteById(credit_note_id!);
		},
		enabled: !!credit_note_id,
	});

	useEffect(() => {
		updateBreadcrumb(breadcrumb_index, data?.credit_note_number ?? credit_note_id);
	}, [credit_note_id, data?.credit_note_number, breadcrumb_index, updateBreadcrumb]);

	const creditNoteRef = useRef<HTMLDivElement>(null);

	if (isLoading) return <Loader />;

	if (isError) {
		toast.error('Something went wrong');
		return (
			<div className='flex min-h-screen justify-center items-center h-full'>
				<Loader />
			</div>
		);
	}

	return (
		<Page className='space-y-6 '>
			<ApiDocsContent tags={['Credit Notes', 'Features']} />
			{/* Main Credit Note Card */}
			<div ref={creditNoteRef} className='rounded-xl border border-gray-300 p-6'>
				<div className='p-4'>
					<div className='flex items-center gap-2'>
						<h3 className={getTypographyClass('card-header') + '!text-[16px]'}>Credit Note Details</h3>
						<div className='text-[#09090B] text-sm'>{getStatusChip(data?.credit_note_status ?? CREDIT_NOTE_STATUS.DRAFT)}</div>
					</div>
					<Spacer className='!my-8' />

					{/* Credit Note Information Grid */}
					<div className='w-full grid grid-cols-4 gap-4 mb-4'>
						<p className='text-[#71717A] text-sm'>Credit Note Number</p>
						<p className='text-[#71717A] text-sm'>Date Created</p>
						<p className='text-[#71717A] text-sm'>Invoice Number</p>
						<p className='text-[#71717A] text-sm'>Type</p>
					</div>
					<div className='w-full grid grid-cols-4 gap-4'>
						<p className='text-[#09090B] text-sm font-medium'>{data?.credit_note_number || data?.id?.slice(0, 8)}</p>
						<p className='text-[#09090B] text-sm font-medium'>{formatDate(data?.created_at ?? '')}</p>
						<div className='text-[#09090B] text-sm'>
							{data?.invoice && (
								<Link to={`${RouteNames.invoices}/${data.invoice.id}`} className='text-[#09090B] text-sm font-medium hover:underline'>
									{invoiceReference(data.invoice)}
								</Link>
							)}
						</div>
						<div className='text-[#09090B] text-sm'>{getTypeChip(data?.credit_note_type ?? CREDIT_NOTE_TYPE.ADJUSTMENT)}</div>
					</div>
				</div>

				<Divider />
				{/* Credit Note Line Items */}
				<CreditNoteLineItemTable
					title='Line Items'
					data={data?.line_items ?? []}
					total_amount={data?.total_amount}
					currency={data?.currency}
					total_label='Total Credit Amount'
				/>
				{data?.memo && (
					<Card variant='default' className='mb-4 p-3'>
						<div className='flex items-start gap-3'>
							<AlertCircle className='size-5 flex-shrink-0 mt-0.5' />
							<div className='flex-1'>
								<p className='text-sm'>{data?.memo}</p>
							</div>
						</div>
					</Card>
				)}
			</div>
		</Page>
	);
};

export default CreditNoteDetails;
