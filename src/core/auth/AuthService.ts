import { NODE_ENV, NodeEnv } from '@/types';
import supabase from '../services/supbase/config';
import { RouteNames } from '../routes/Routes';
import { clearPlaqadSession, getPlaqadAccessToken, getPlaqadUser, PLAQAD_AUTH_ENABLED, signOutPlaqad } from './PlaqadAuth';

class AuthService {
	public static async getAcessToken() {
		if (PLAQAD_AUTH_ENABLED) return getPlaqadAccessToken();
		if (NODE_ENV != NodeEnv.SELF_HOSTED) {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			return session?.access_token;
		} else {
			try {
				const tokenData = localStorage.getItem('token');
				if (!tokenData) return null;
				const parsedToken = JSON.parse(tokenData);
				return parsedToken.token;
			} catch (error) {
				console.error('Error parsing token:', error);
				return null;
			}
		}
	}

	public static async getUser() {
		if (PLAQAD_AUTH_ENABLED) return getPlaqadUser();
		if (NODE_ENV != NodeEnv.SELF_HOSTED) {
			const { data } = await supabase.auth.getUser();
			return data.user;
		} else {
			try {
				const tokenData = localStorage.getItem('token');
				if (!tokenData) return null;
				const parsedToken = JSON.parse(tokenData);
				return parsedToken.user;
			} catch (error) {
				console.error('Error parsing user data:', error);
				return null;
			}
		}
	}

	public static async logout(global = true) {
		if (PLAQAD_AUTH_ENABLED) {
			if (global) await signOutPlaqad();
			else clearPlaqadSession();
			localStorage.removeItem('user');
			window.location.href = RouteNames.login;
			return;
		}
		if (NODE_ENV != NodeEnv.SELF_HOSTED) {
			await supabase.auth.signOut();
		}
		localStorage.clear();
		window.location.href = RouteNames.login;
	}
}

export default AuthService;
