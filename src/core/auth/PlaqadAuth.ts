const TOKEN_KEY = 'plaqad_flexprice_token';
const TOKEN_EXPIRY_KEY = 'plaqad_flexprice_token_expires_at';
const TOKEN_USER_KEY = 'plaqad_flexprice_user';
const PKCE_VERIFIER_KEY = 'plaqad_flexprice_pkce_verifier';
const OAUTH_STATE_KEY = 'plaqad_flexprice_oauth_state';
const RETURN_TO_KEY = 'plaqad_flexprice_return_to';

export const PLAQAD_AUTH_ENABLED = import.meta.env.VITE_PLAQAD_AUTH_ENABLED === 'true';
const AUTH_URL = import.meta.env.VITE_PLAQAD_AUTH_URL || 'https://account-api.plaqad.com';
const CLIENT_ID = import.meta.env.VITE_PLAQAD_CLIENT_ID || '';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/v1';
export const PLAQAD_CALLBACK_PATH = '/auth/plaqad/callback';

interface PlaqadUser {
	sub: string;
	email: string;
	name: string;
}

interface TokenResponse {
	token: string;
	expiresAt: number;
	user?: PlaqadUser;
}

let refreshPromise: Promise<string | null> | null = null;

function base64Url(bytes: Uint8Array): string {
	let value = '';
	for (const byte of bytes) value += String.fromCharCode(byte);
	return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
	const verifierBytes = new Uint8Array(32);
	crypto.getRandomValues(verifierBytes);
	const codeVerifier = base64Url(verifierBytes);
	const challenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
	return { codeVerifier, codeChallenge: base64Url(new Uint8Array(challenge)) };
}

function normalizeExpiry(expiresAt: number): number {
	return expiresAt < 1_000_000_000_000 ? expiresAt * 1000 : expiresAt;
}

function rememberToken(response: TokenResponse): void {
	sessionStorage.setItem(TOKEN_KEY, response.token);
	sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(normalizeExpiry(response.expiresAt)));
	if (response.user) sessionStorage.setItem(TOKEN_USER_KEY, JSON.stringify(response.user));
}

async function readJsonResponse<T>(response: Response, fallback: string): Promise<T> {
	const body = (await response.json().catch(() => null)) as ({ message?: string; error?: string } & T) | null;
	if (!response.ok) throw new Error(body?.message || body?.error || fallback);
	if (!body) throw new Error(fallback);
	return body;
}

export async function startPlaqadLogin(returnTo = '/'): Promise<void> {
	if (!CLIENT_ID) throw new Error('Plaqad dashboard client is not configured.');
	const { codeVerifier, codeChallenge } = await generatePkce();
	const state = crypto.randomUUID();
	sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
	sessionStorage.setItem(OAUTH_STATE_KEY, state);
	if (returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.startsWith(PLAQAD_CALLBACK_PATH)) {
		sessionStorage.setItem(RETURN_TO_KEY, returnTo);
	}

	const url = new URL('/authorize', AUTH_URL);
	url.searchParams.set('client_id', CLIENT_ID);
	url.searchParams.set('redirect_uri', `${window.location.origin}${PLAQAD_CALLBACK_PATH}`);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('state', state);
	url.searchParams.set('code_challenge', codeChallenge);
	url.searchParams.set('code_challenge_method', 'S256');
	window.location.assign(url.toString());
}

export async function completePlaqadLogin(code: string, state: string): Promise<string> {
	const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
	const codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
	if (!expectedState || state !== expectedState || !codeVerifier) {
		throw new Error('Sign-in state did not match. Please start again.');
	}
	sessionStorage.removeItem(OAUTH_STATE_KEY);
	sessionStorage.removeItem(PKCE_VERIFIER_KEY);

	const response = await fetch(`${API_URL}/auth/plaqad/callback`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code, code_verifier: codeVerifier }),
	});
	const result = await readJsonResponse<TokenResponse>(response, 'Plaqad sign-in failed.');
	rememberToken(result);
	return result.token;
}

async function refreshPlaqadToken(): Promise<string | null> {
	if (!CLIENT_ID) return null;
	const response = await fetch(`${AUTH_URL}/api/v1/token/refresh`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ client_id: CLIENT_ID }),
	});
	if (!response.ok) return null;
	const result = await readJsonResponse<TokenResponse>(response, 'Plaqad session refresh failed.');
	rememberToken(result);
	return result.token;
}

export async function getPlaqadAccessToken(): Promise<string | null> {
	const token = sessionStorage.getItem(TOKEN_KEY);
	if (!token) return null;
	const expiresAt = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY));
	if (!Number.isFinite(expiresAt) || expiresAt - Date.now() > 60_000) return token;

	refreshPromise ??= refreshPlaqadToken().finally(() => {
		refreshPromise = null;
	});
	const refreshed = await refreshPromise;
	if (!refreshed) clearPlaqadSession();
	return refreshed;
}

export function getPlaqadUser(): PlaqadUser | null {
	const raw = sessionStorage.getItem(TOKEN_USER_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as PlaqadUser;
	} catch {
		return null;
	}
}

export function consumePlaqadReturnTo(): string {
	const value = sessionStorage.getItem(RETURN_TO_KEY);
	sessionStorage.removeItem(RETURN_TO_KEY);
	return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function clearPlaqadSession(): void {
	for (const key of [TOKEN_KEY, TOKEN_EXPIRY_KEY, TOKEN_USER_KEY, PKCE_VERIFIER_KEY, OAUTH_STATE_KEY, RETURN_TO_KEY]) {
		sessionStorage.removeItem(key);
	}
}

export async function signOutPlaqad(): Promise<void> {
	const token = sessionStorage.getItem(TOKEN_KEY);
	try {
		await fetch(`${AUTH_URL}/api/v1/auth/logout`, {
			method: 'POST',
			credentials: 'include',
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		});
	} finally {
		clearPlaqadSession();
	}
}
