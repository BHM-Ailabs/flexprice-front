import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import LoginForm from './LoginForm';
const flexpriceLogo = '/plaqad-bsp.svg';
import SignupForm from './SignupForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';
import AuthService from '@/core/auth/AuthService';
import LandingSection from './LandingSection';
import RegionSelector from '@/components/molecules/RegionSelector/RegionSelector';
import { AuthTab } from './authTabs';
import PlaqadLogin from './PlaqadLogin';
import { PLAQAD_AUTH_ENABLED } from '@/core/auth/PlaqadAuth';

const AuthPage: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();

	// Get current tab from URL or default to login
	const [currentTab, setCurrentTab] = useState<AuthTab>(AuthTab.LOGIN);

	useEffect(() => {
		const searchParams = new URLSearchParams(location.search);
		if (searchParams.get('tab') === AuthTab.RESET_PASSWORD) {
			return;
		}
		const fetchUser = async () => {
			const tokenStr = await AuthService.getAcessToken();
			if (tokenStr) {
				navigate('/');
			}
		};
		fetchUser();
	}, [location.search, navigate]);

	// Parse query parameters on component mount and tab changes
	useEffect(() => {
		const searchParams = new URLSearchParams(location.search);
		const tab = searchParams.get('tab');
		if (tab === AuthTab.SIGNUP || tab === AuthTab.FORGOT_PASSWORD || tab === AuthTab.RESET_PASSWORD) {
			setCurrentTab(tab as AuthTab);
		} else {
			setCurrentTab(AuthTab.LOGIN);
		}
	}, [location]);

	// Change tab and update URL
	const switchTab = (tab: AuthTab) => {
		navigate(`/auth?tab=${tab}`);
	};

	// Render the appropriate form based on the current tab
	const renderForm = () => {
		switch (currentTab) {
			case AuthTab.SIGNUP:
				return (
					<>
						<SignupForm switchTab={switchTab} />
					</>
				);

			case AuthTab.FORGOT_PASSWORD:
				return (
					<>
						<ForgotPasswordForm switchTab={switchTab} />
					</>
				);

			case AuthTab.RESET_PASSWORD:
				return (
					<>
						<ResetPasswordForm switchTab={switchTab} />
					</>
				);

			default: // Login case
				return (
					<>
						<LoginForm switchTab={switchTab} />
					</>
				);
		}
	};

	if (PLAQAD_AUTH_ENABLED) return <PlaqadLogin />;

	return (
		<div className='flex w-full min-h-screen bg-white page !p-0 !flex-row'>
			{/* Left side - Auth Form */}
			<div className='w-[45%] flex flex-col'>
				{/* Form Container */}
				<div className='flex-1 flex justify-center items-center pt-[10px]'>
					<div className='flex flex-col justify-center max-w-xl w-[55%] mx-auto'>
						<div className='flex justify-center mb-4'>
							<img src={flexpriceLogo} alt='Plaqad BSP Logo' className='h-12' />
						</div>

						{currentTab === AuthTab.SIGNUP && (
							<>
								<h2 className='text-3xl font-medium text-center text-gray-800 mb-2'>Create your account</h2>
								<p className='text-center text-gray-600 mb-10'>Sign up to start using Plaqad BSP.</p>
								<div className='mb-6'>
									<RegionSelector />
								</div>
							</>
						)}
						{currentTab === AuthTab.LOGIN && (
							<>
								<h2 className='text-3xl font-medium text-center text-gray-800 mb-3'>Login to your account</h2>
								<p className='text-center text-gray-600 mb-10'>Let's get you back in.</p>
								<div className='mb-6'>
									<RegionSelector />
								</div>
							</>
						)}
						{currentTab === AuthTab.FORGOT_PASSWORD && (
							<>
								<h2 className='text-3xl font-medium text-center text-gray-800 mb-2'>Forgot your password?</h2>
								<p className='text-center text-gray-600 mb-8'>Enter your email to reset your password.</p>
							</>
						)}
						{currentTab === AuthTab.RESET_PASSWORD && (
							<>
								<h2 className='text-3xl font-medium text-center text-gray-800 mb-2'>Set a new password</h2>
								<p className='text-center text-gray-600 mb-8'>Enter your new password below.</p>
							</>
						)}

						{renderForm()}
					</div>
				</div>
			</div>

			{/* Right side - Marketing Content */}
			<div className='w-[55%] min-h-screen flex'>
				<LandingSection />
			</div>
		</div>
	);
};

export default AuthPage;
