import { SignJWT, jwtVerify } from 'jose';
import { json } from './_posts';

export type AuthMode = 'dev' | 'synology';
export type AuthUser = {
	sub: string;
	name: string;
	email?: string;
};

const SESSION_ISSUER = 'if-tech-blog-cms';
const SESSION_AUDIENCE = 'if-tech-blog-admin';
const LOCAL_DEV_USER: AuthUser = { sub: 'local-dev-user', name: '로컬 개발자' };

export function getAuthMode(): AuthMode {
	return process.env.CMS_AUTH_MODE === 'dev' ? 'dev' : 'synology';
}

export function isSafeDevAuth() {
	return (
		getAuthMode() === 'dev' &&
		process.env.NETLIFY_DEV === 'true' &&
		process.env.NODE_ENV !== 'production' &&
		process.env.CONTEXT !== 'production'
	);
}

export function getSessionSecret() {
	const secret = process.env.CMS_SESSION_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error('CMS_SESSION_SECRET은 32자 이상으로 설정해야 합니다.');
	}
	return new TextEncoder().encode(secret);
}

export function sessionCookieName() {
	return getAuthMode() === 'synology' ? '__Host-iftech_cms_session' : 'iftech_cms_session';
}

export function transactionCookieName() {
	return getAuthMode() === 'synology' ? '__Host-iftech_oidc_tx' : 'iftech_oidc_tx';
}

export function cookieOptions(maxAge: number) {
	return [
		`Path=/`,
		`HttpOnly`,
		`SameSite=Lax`,
		`Max-Age=${maxAge}`,
		...(getAuthMode() === 'synology' ? ['Secure'] : [])
	].join('; ');
}

export async function createSessionToken(user: AuthUser) {
	return new SignJWT({ name: user.name, email: user.email })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(user.sub)
		.setIssuer(SESSION_ISSUER)
		.setAudience(SESSION_AUDIENCE)
		.setIssuedAt()
		.setExpirationTime('8h')
		.sign(getSessionSecret());
}

export async function getSessionUser(request: Request): Promise<AuthUser | null> {
	if (getAuthMode() === 'dev') return isSafeDevAuth() ? LOCAL_DEV_USER : null;
	const token = readCookie(request, sessionCookieName());
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, getSessionSecret(), {
			issuer: SESSION_ISSUER,
			audience: SESSION_AUDIENCE,
			algorithms: ['HS256']
		});
		if (!payload.sub || typeof payload.name !== 'string' || !payload.name.trim()) return null;
		return {
			sub: payload.sub,
			name: payload.name.trim(),
			...(typeof payload.email === 'string' ? { email: payload.email } : {})
		};
	} catch {
		return null;
	}
}

export async function requireAuth(request: Request) {
	const user = await getSessionUser(request);
	if (!user) {
		return { response: json({ ok: false, message: '로그인이 필요합니다.' }, 401) } as const;
	}
	if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && getAuthMode() === 'synology') {
		const origin = request.headers.get('origin');
		if (!origin || origin !== new URL(request.url).origin) {
			return {
				response: json({ ok: false, message: '요청 출처를 확인할 수 없습니다.' }, 403)
			} as const;
		}
	}
	return { user } as const;
}

export function readCookie(request: Request, name: string) {
	const cookie = request.headers.get('cookie') || '';
	for (const pair of cookie.split(';')) {
		const [key, ...value] = pair.trim().split('=');
		if (key === name) return decodeURIComponent(value.join('='));
	}
	return null;
}

export function safeReturnTo(value: string | null | undefined) {
	return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}
