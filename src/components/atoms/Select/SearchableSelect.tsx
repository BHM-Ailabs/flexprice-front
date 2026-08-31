import { useState, useCallback, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, Circle } from 'lucide-react';
import React from 'react';

export interface SelectOption {
	value: string;
	label: string;
	suffixIcon?: React.ReactNode;
	prefixIcon?: React.ReactNode;
	description?: string;
	supportingText?: string;
	disabled?: boolean;
}

interface SearchableSelectProps {
	options: SelectOption[];
	value?: string;
	defaultOpen?: boolean;
	placeholder?: string;
	label?: string;
	description?: string;
	error?: string;
	onChange?: (value: string) => void;
	disabled?: boolean;
	isRadio?: boolean;
	className?: string;
	noOptionsText?: string;
	hideSelectedTick?: boolean;
	trigger?: React.ReactNode;
	searchPlaceholder?: string;
	emptyText?: string;
	maxHeight?: number;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
	disabled = false,
	options,
	value,
	placeholder = 'Select an option',
	label = '',
	description,
	onChange,
	error,
	isRadio,
	className,
	noOptionsText = 'No options found',
	defaultOpen = false,
	hideSelectedTick = true,
	trigger,
	searchPlaceholder = 'Search options...',
	emptyText = 'No options found.',
	maxHeight = 300,
}) => {
	const [open, setOpen] = useState(defaultOpen);
	const [searchQuery, setSearchQuery] = useState('');

	const handleOpenChange = useCallback((newOpen: boolean) => {
		setOpen(newOpen);
		if (!newOpen) {
			setSearchQuery('');
		}
	}, []);

	// Let Command component handle filtering since we're using option.label as the value

	const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value]);

	const handleSelect = useCallback(
		(currentValue: string) => {
			if (onChange) {
				onChange(currentValue === value ? '' : currentValue);
			}
			setOpen(false);
			setSearchQuery('');
		},
		[onChange, value],
	);

	const renderRadioOption = (option: SelectOption) => (
		<CommandItem
			key={option.value}
			value={`${option.label} ${option.description || ''} ${option.supportingText || ''}`}
			onSelect={() => handleSelect(option.value)}
			disabled={option.disabled}
			className={cn(
				'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
				'focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				option.disabled && 'select-none cursor-not-allowed',
			)}>
			{/* Radio Icon */}
			<span className='absolute left-2 top-[10px] flex h-4 w-4 justify-center'>
				{value === option.value ? <Circle className='size-2 text-black fill-current' /> : null}
				<Circle className='size-4 text-gray-400 absolute' />
			</span>

			<div className='flex w-full items-center gap-2'>
				<div className='mr-2 flex w-full flex-col gap-0.5'>
					<span className='break-words'>{option.label}</span>
					{option.description && <span className='break-words text-sm text-muted-foreground'>{option.description}</span>}
					{option.supportingText && <span className='break-all font-mono text-xs text-muted-foreground'>{option.supportingText}</span>}
				</div>
			</div>
		</CommandItem>
	);

	const renderStandardOption = (option: SelectOption) => (
		<CommandItem
			key={option.value}
			value={`${option.label} ${option.description || ''} ${option.supportingText || ''}`}
			onSelect={() => handleSelect(option.value)}
			disabled={option.disabled}
			className={cn(
				'flex w-full cursor-pointer items-center justify-between gap-2',
				option.disabled && 'select-none cursor-not-allowed opacity-50',
			)}>
			<div
				className={cn(
					'flex w-full items-center justify-between gap-2',
					option.disabled && 'opacity-50 pointer-events-none',
					option.suffixIcon && 'pr-8',
					hideSelectedTick && '!pl-0',
				)}>
				{option.prefixIcon && option.prefixIcon}

				<div className={cn('flex w-full flex-col gap-0.5', !hideSelectedTick && 'mr-0')}>
					<span className='break-words'>{option.label}</span>
					{option.description && <span className='break-words text-sm text-muted-foreground'>{option.description}</span>}
					{option.supportingText && <span className='break-all font-mono text-xs text-muted-foreground'>{option.supportingText}</span>}
				</div>

				<div className='flex items-center gap-2'>
					{option.suffixIcon && <span>{option.suffixIcon}</span>}
					{!hideSelectedTick && <Check className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')} />}
				</div>
			</div>
		</CommandItem>
	);

	return (
		<div className={cn('space-y-1')}>
			{/* Label */}
			{label && (
				<label className={cn(' block text-sm font-medium text-zinc break-words', disabled ? 'text-zinc-500' : 'text-zinc-950')}>
					{label}
				</label>
			)}

			<Popover open={open} onOpenChange={handleOpenChange}>
				<PopoverTrigger asChild>
					<button
						className={cn(
							'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
							'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
							'disabled:cursor-not-allowed disabled:opacity-50',
							disabled && 'cursor-not-allowed',
							className,
						)}
						disabled={disabled}
						type='button'>
						{trigger ? (
							trigger
						) : (
							<>
								<span className={cn('truncate', value ? '' : 'text-muted-foreground')}>{selectedOption?.label || placeholder}</span>
								<ChevronDown className='size-4 opacity-50' />
							</>
						)}
					</button>
				</PopoverTrigger>
				<PopoverContent className='w-[var(--radix-popover-trigger-width)] p-0' align='start'>
					<Command>
						<CommandInput placeholder={searchPlaceholder} value={searchQuery} onValueChange={setSearchQuery} className='h-9' />
						<CommandList style={{ maxHeight }}>
							<CommandEmpty>{emptyText}</CommandEmpty>
							<CommandGroup>
								{options.length > 0 ? (
									options.map((option) => (isRadio ? renderRadioOption(option) : renderStandardOption(option)))
								) : (
									<CommandItem disabled>
										<div className='flex w-full items-center gap-2'>
											<div className='mr-2 flex w-full flex-col'>
												<span className='break-words'>{noOptionsText}</span>
											</div>
										</div>
									</CommandItem>
								)}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{/* Description */}
			{description && <p className='text-sm text-muted-foreground break-words'>{description}</p>}

			{/* Error Message */}
			{error && <p className='text-sm text-destructive break-words'>{error}</p>}
		</div>
	);
};

export default SearchableSelect;
