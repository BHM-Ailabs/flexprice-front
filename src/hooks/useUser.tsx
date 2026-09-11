import { useQuery } from '@tanstack/react-query';
import { UserApi } from '@/api/UserApi';
import AuthService from '@/core/auth/AuthService';
import { PlaqadReauthenticationError } from '@/core/auth/PlaqadAuth';

const useUser = () => {
	const {
		data: user,
		isLoading: loading,
		error,
		refetch,
	} = useQuery({
		queryKey: ['user'],
		queryFn: async () => {
			const token = await AuthService.getAcessToken();
			if (!token) return null;
			return await UserApi.me();
		},
		retry: (count, error) => !(error instanceof PlaqadReauthenticationError) && count < 2,
		retryDelay: 1000,
		// gcTime: 1000 * 60 * 5,
		// staleTime: 1000 * 60 * 5,
	});

	return { user: user ?? undefined, loading, error, refetch };
};

export default useUser;
