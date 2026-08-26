import { Button, Input } from '@/components/atoms';
import { PlanMetadataFieldError } from '@/lib/planMetadataFields';
import { Plus, Trash2 } from 'lucide-react';

export interface PlanMetadataField {
	id: string;
	key: string;
	value: string;
}

interface PlanMetadataFieldsSectionProps {
	fields: PlanMetadataField[];
	errors?: PlanMetadataFieldError[];
	onChange: (fields: PlanMetadataField[]) => void;
	onAdd: () => void;
}

const PlanMetadataFieldsSection = ({ fields, errors = [], onChange, onAdd }: PlanMetadataFieldsSectionProps) => {
	const updateField = (index: number, changes: Partial<PlanMetadataField>) => {
		onChange(fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...changes } : field)));
	};

	return (
		<section className='rounded-[6px] border border-gray-300 p-5' aria-labelledby='plan-metadata-title'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h3 id='plan-metadata-title' className='text-sm font-semibold text-zinc-950'>
						Additional integration fields
					</h3>
					<p className='mt-1 max-w-[65ch] text-sm text-zinc-600'>
						Optional labels used by your internal systems. Add a key and value; no JSON or code is required.
					</p>
				</div>
				<Button type='button' variant='outline' size='sm' prefixIcon={<Plus aria-hidden='true' />} onClick={onAdd}>
					Add field
				</Button>
			</div>

			{fields.length === 0 ? (
				<p className='mt-4 rounded-[6px] bg-zinc-50 px-3 py-2 text-sm text-zinc-600'>No additional integration fields.</p>
			) : (
				<div className='mt-5 space-y-4'>
					{fields.map((field, index) => (
						<div key={field.id} className='grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]'>
							<Input
								id={`${field.id}-key`}
								label={`Key ${index + 1}`}
								placeholder='contract_reference'
								value={field.key}
								error={errors[index]?.key}
								onChange={(key) => updateField(index, { key })}
							/>
							<Input
								id={`${field.id}-value`}
								label={`Value ${index + 1}`}
								placeholder='ENT-1042'
								value={field.value}
								onChange={(value) => updateField(index, { value })}
							/>
							<Button
								type='button'
								variant='ghost'
								size='icon'
								className='text-zinc-500 hover:text-destructive sm:mt-5'
								aria-label={`Remove metadata field ${index + 1}`}
								onClick={() => onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))}>
								<Trash2 aria-hidden='true' />
							</Button>
						</div>
					))}
				</div>
			)}
		</section>
	);
};

export default PlanMetadataFieldsSection;
