import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { getSessionSecret } from './_auth';

type OidcMetadata = {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint?: string;
	jwks_uri: string;
};

export type LoginTransaction = {
	state: string;
	nonce: string;
	codeVerifier: string;
	returnTo: string;
};

function required(name: string) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
	return value;
}

export async function getOidcConfig(): Promise<
	OidcMetadata & { clientId: string; clientSecret: string; redirectUri: string }
> {
	const issuer = required('SYNOLOGY_OIDC_ISSUER').replace(/\/+$/, '');
	let discovered: Partial<OidcMetadata> = {};
	const hasExplicitEndpoints =
		process.env.SYNOLOGY_OIDC_AUTHORIZATION_ENDPOINT &&
		process.env.SYNOLOGY_OIDC_TOKEN_ENDPOINT &&
		process.env.SYNOLOGY_OIDC_JWKS_URI;
	if (!hasExplicitEndpoints) {
		const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
			headers: { Accept: 'application/json' }
		});
		if (!response.ok) throw new Error('Synology OIDC 메타데이터를 불러오지 못했습니다.');
		discovered = await response.json();
	}
	const metadata: OidcMetadata = {
		issuer: String(discovered.issuer || issuer).replace(/\/+$/, ''),
		authorization_endpoint: String(
			process.env.SYNOLOGY_OIDC_AUTHORIZATION_ENDPOINT || discovered.authorization_endpoint || ''
		),
		token_endpoint: String(
			process.env.SYNOLOGY_OIDC_TOKEN_ENDPOINT || discovered.token_endpoint || ''
		),
		userinfo_endpoint:
			String(process.env.SYNOLOGY_OIDC_USERINFO_ENDPOINT || discovered.userinfo_endpoint || '') ||
			undefined,
		jwks_uri: String(process.env.SYNOLOGY_OIDC_JWKS_URI || discovered.jwks_uri || '')
	};
	for (const [key, value] of Object.entries(metadata)) {
		if (key !== 'userinfo_endpoint' && !value) throw new Error(`OIDC ${key} 설정을 확인해 주세요.`);
		if (value && new URL(value).protocol !== 'https:')
			throw new Error(`OIDC ${key}는 HTTPS URL이어야 합니다.`);
	}
	return {
		...metadata,
		clientId: required('SYNOLOGY_OIDC_CLIENT_ID'),
		clientSecret: required('SYNOLOGY_OIDC_CLIENT_SECRET'),
		redirectUri: required('SYNOLOGY_OIDC_REDIRECT_URI')
	};
}

export function randomUrlSafe(bytes = 32) {
	return randomBytes(bytes).toString('base64url');
}

export function pkceChallenge(verifier: string) {
	return createHash('sha256').update(verifier).digest('base64url');
}

export async function createTransactionToken(value: LoginTransaction) {
	return new SignJWT({ ...value })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuer('if-tech-blog-cms')
		.setAudience('if-tech-blog-oidc-callback')
		.setIssuedAt()
		.setExpirationTime('10m')
		.sign(getSessionSecret());
}

export async function verifyTransactionToken(token: string) {
	const { payload } = await jwtVerify(token, getSessionSecret(), {
		issuer: 'if-tech-blog-cms',
		audience: 'if-tech-blog-oidc-callback',
		algorithms: ['HS256']
	});
	for (const key of ['state', 'nonce', 'codeVerifier', 'returnTo'] as const) {
		if (typeof payload[key] !== 'string' || !payload[key])
			throw new Error('로그인 요청 정보가 올바르지 않습니다.');
	}
	return payload as unknown as LoginTransaction;
}

export async function exchangeAuthorizationCode(code: string, transaction: LoginTransaction) {
	const config = await getOidcConfig();
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: config.redirectUri,
		client_id: config.clientId,
		code_verifier: transaction.codeVerifier
	});
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded'
	};
	if (process.env.SYNOLOGY_OIDC_TOKEN_AUTH_METHOD === 'client_secret_basic') {
		headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
	} else {
		body.set('client_secret', config.clientSecret);
	}
	const response = await fetch(config.token_endpoint, { method: 'POST', headers, body });
	const tokens = await response.json().catch(() => null);
	if (!response.ok || !tokens?.id_token || !tokens?.access_token) {
		throw new Error('Synology에서 로그인 토큰을 발급받지 못했습니다.');
	}
	const { payload } = await jwtVerify(
		String(tokens.id_token),
		createRemoteJWKSet(new URL(config.jwks_uri)),
		{
			issuer: config.issuer,
			audience: config.clientId,
			algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']
		}
	);
	if (payload.nonce !== transaction.nonce || !payload.sub) {
		throw new Error('로그인 토큰의 nonce 또는 사용자 식별자가 올바르지 않습니다.');
	}
	let userinfo: Record<string, unknown> = {};
	if (config.userinfo_endpoint) {
		const userResponse = await fetch(config.userinfo_endpoint, {
			headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' }
		});
		userinfo = await userResponse.json().catch(() => ({}));
		if (!userResponse.ok || userinfo.sub !== payload.sub) {
			throw new Error('Synology 사용자 정보를 검증하지 못했습니다.');
		}
	}
	const name = [
		userinfo.name,
		userinfo.preferred_username,
		payload.name,
		payload.preferred_username,
		userinfo.email,
		payload.email
	].find((value) => typeof value === 'string' && value.trim());
	if (typeof name !== 'string') throw new Error('로그인 사용자 이름을 확인할 수 없습니다.');
	const email = [userinfo.email, payload.email].find((value) => typeof value === 'string');
	return {
		sub: payload.sub,
		name: name.trim(),
		...(typeof email === 'string' ? { email } : {})
	};
}
