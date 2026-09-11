import { invoiceReference } from '@/utils/invoices/invoiceReference';
import { CreditNote } from '@/models';
import { CREDIT_NOTE_STATUS, CREDIT_NOTE_TYPE } from '@/types/dto';
import { FC } from 'react';
import FlexpriceTable, { ColumnData, RedirectCell } from '../Table';
import { formatDateShort, getCurrencySymbol } from '@/utils/common/helper_functions';
import { Chip } from '@/components/atoms';
import { useNavigate } from 'react-router';
import { RouteNames } from '@/core/routes/Routes';

export interface Props {
	data: CreditNote[];
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
			return <Chip variant='info' label='Adjustment' />;
		default:
			return <Chip variant='default' label='Unknown' />;
	}
};

const CreditNoteTable: FC<Props> = ({ data }) => {
	const navigate = useNavigate();

	const columns: ColumnData<CreditNote>[] = [
		{
			title: 'Credit Note ID',

			render: (row: CreditNote) => row.credit_note_number || row.id.slice(0, 8),
		},
		{
			title: 'Amount',
			render: (row: CreditNote) => <span>{`${getCurrencySymbol(row.currency)}${row.total_amount}`}</span>,
		},
		{
			title: 'Status',
			render: (row: CreditNote) => getStatusChip(row.credit_note_status),
		},
		{
			title: 'Type',
			render: (row: CreditNote) => getTypeChip(row.credit_note_type),
		},
		{
			title: 'Invoice',
			render: (row: CreditNote) => {
				if (!row.invoice_id) return '--';

				return <RedirectCell redirectUrl={`${RouteNames.invoices}/${row.invoice_id}`}>{invoiceReference(row.invoice)}</RedirectCell>;
			},
		},
		{
			title: 'Customer',
			render: (row: CreditNote) => {
				if (!row.customer?.id) return '--';

				return (
					<RedirectCell redirectUrl={`${RouteNames.customers}/${row.customer?.id}`}>
						{row.customer?.name || row.customer?.external_id}
					</RedirectCell>
				);
			},
		},
		{
			title: 'Created Date',
			render: (row: CreditNote) => <span>{formatDateShort(row.created_at)}</span>,
		},
	];

	return (
		<div>
			<FlexpriceTable
				showEmptyRow={true}
				onRowClick={(row) => {
					navigate(`${RouteNames.creditNotes}/${row.id}`);
				}}
				columns={columns}
				data={data}
			/>
		</div>
	);
};

export default CreditNoteTable;
