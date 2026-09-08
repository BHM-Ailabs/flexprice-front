import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/atoms';
import { FC, useEffect } from 'react';

interface Props {
	children?: React.ReactNode;
	className?: string;
	type?: 'left-aligned' | 'default';
	header?: React.ReactNode;
	heading?: string | React.ReactNode;
	headingClassName?: string;
	headingCTA?: React.ReactNode;
	documentTitle?: string;
}

const Page: FC<Props> = ({ children, className, type = 'default', header, heading, headingClassName, headingCTA, documentTitle }) => {
	if (heading && header) {
		throw new Error('You cannot pass both heading and header props');
	}

	useEffect(() => {
		// Use documentTitle if provided, otherwise try to extract string from heading
		if (documentTitle) {
			document.title = `${documentTitle} | Plaqad BSP`;
		} else if (heading) {
			// If heading is a string, use it directly
			if (typeof heading === 'string') {
				document.title = `${heading} | Plaqad BSP`;
			}
			// If heading is a ReactNode, don't set title (to avoid "[object Object]")
		}
	}, [heading, documentTitle]);

	return (
		<div className='min-h-screen flex flex-col'>
			<div
				className={cn(
					'flex-1 page w-full p-0!',
					type === 'left-aligned' && '!px-12',
					type === 'default' && 'mx-auto max-w-screen-lg',
					className,
				)}>
				{header && header}
				{heading && (
					<SectionHeader title={heading} titleClassName={cn(headingClassName, 'text-3xl font-medium')}>
						{headingCTA}
					</SectionHeader>
				)}
				<div className='pb-12 mt-2'>{children}</div>
			</div>
		</div>
	);
};

export default Page;
