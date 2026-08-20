import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/atoms';
import { completePlaqadLogin, consumePlaqadReturnTo, startPlaqadLogin } from '@/core/auth/PlaqadAuth';

const PlaqadCallback = () => {
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const started = useRef(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		const code = params.get('code');
		const state = params.get('state');
		if (!code || !state) {
			setError('Plaqad did not return a valid authorization code.');
			return;
		}
		void completePlaqadLogin(code, state)
			.then(() => navigate(consumePlaqadReturnTo(), { replace: true }))
			.catch((cause) => setError(cause instanceof Error ? cause.message : 'Plaqad sign-in failed.'));
	}, [navigate, params]);

	if (error) {
		return (
			<main className='min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6'>
				<section className='w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-8'>
					<h1 className='text-xl font-semibold'>Sign-in failed</h1>
					<p className='my-4 text-sm text-zinc-400'>{error}</p>
					<Button className='w-full bg-white text-zinc-950' onClick={() => void startPlaqadLogin('/')}>
						Try again
					</Button>
				</section>
			</main>
		);
	}

	return (
		<main className='min-h-screen bg-zinc-950 text-white flex items-center justify-center'>
			<div className='h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-white' aria-label='Completing sign-in' />
		</main>
	);
};

export default PlaqadCallback;
