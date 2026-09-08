const LandingSection = () => (
	<section className='flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-10 py-14'>
		<div className='max-w-lg'>
			<p className='mb-4 text-sm font-medium text-zinc-500'>Plaqad BSP</p>
			<h2 className='text-3xl font-semibold tracking-tight text-zinc-950'>Manage pricing and billing across your products.</h2>
			<p className='mt-5 text-base leading-7 text-zinc-600'>
				Configure plans, review usage, manage invoices and understand revenue from one dashboard.
			</p>
			<ul className='mt-8 space-y-4 text-sm text-zinc-700'>
				<li>Build and preview pricing plans with AI.</li>
				<li>Review billing records and customer activity.</li>
				<li>Ask questions using live records and attached files.</li>
			</ul>
		</div>
	</section>
);
export default LandingSection;
