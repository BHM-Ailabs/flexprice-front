import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/atoms';
import { startPlaqadLogin } from '@/core/auth/PlaqadAuth';
const flexpriceLogo = '/plaqad-bsp.svg';

const PlaqadLogin = () => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const signIn = async () => {
		setLoading(true);
		setError(null);
		try {
			await startPlaqadLogin(`${window.location.pathname}${window.location.search}`);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Unable to start Plaqad sign-in.');
			setLoading(false);
		}
	};

	return (
		<main className='min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6'>
			<section className='w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-8 shadow-2xl'>
				<div className='mb-8 flex items-center gap-3'>
					<img src={flexpriceLogo} alt='Plaqad BSP' className='h-10 w-10 rounded-lg' />
					<div>
						<p className='text-xs uppercase tracking-[0.18em] text-zinc-400'>Billing control plane</p>
						<h1 className='text-xl font-semibold'>Plaqad BSP</h1>
					</div>
				</div>

				<div className='mb-8'>
					<div className='mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10'>
						<ShieldCheck className='h-5 w-5 text-emerald-400' />
					</div>
					<h2 className='text-2xl font-semibold tracking-tight'>Super Admin access</h2>
					<p className='mt-2 text-sm leading-6 text-zinc-400'>
						Continue through Plaqad Account. Access is checked against your live Super Admin status on every dashboard request.
					</p>
				</div>

				{error && <p className='mb-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200'>{error}</p>}
				<Button onClick={signIn} className='h-11 w-full bg-white text-zinc-950 hover:bg-zinc-200' isLoading={loading}>
					Continue to Plaqad BSP
				</Button>
				<p className='mt-5 text-center text-xs text-zinc-500'>Native Plaqad BSP credentials cannot authorize this dashboard.</p>
			</section>
		</main>
	);
};

export default PlaqadLogin;
