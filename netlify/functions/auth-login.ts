import {
	cookieOptions,
	getAuthMode,
	isSafeDevAuth,
	safeReturnTo,
	transactionCookieName
} from './_auth';
import { createTransactionToken, getOidcConfig, pkceChallenge, randomUrlSafe } from './_oidc';

export default async (request: Request) => {
	const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'));
	if (getAuthMode() === 'dev') {
		if (!isSafeDevAuth())
			return new Response('개발 인증은 로컬 netlify dev에서만 사용할 수 있습니다.', {
				status: 403
			});
		return Response.redirect(new URL(returnTo, request.url), 302);
	}
	try {
		const config = await getOidcConfig();
		const transaction = {
			state: randomUrlSafe(),
			nonce: randomUrlSafe(),
			codeVerifier: randomUrlSafe(48),
			returnTo
		};
		const authorizeUrl = new URL(config.authorization_endpoint);
		authorizeUrl.search = new URLSearchParams({
			response_type: 'code',
			client_id: config.clientId,
			redirect_uri: config.redirectUri,
			scope: 'openid profile email',
			state: transaction.state,
			nonce: transaction.nonce,
			code_challenge: pkceChallenge(transaction.codeVerifier),
			code_challenge_method: 'S256'
		}).toString();
		return new Response(null, {
			status: 302,
			headers: {
				Location: authorizeUrl.toString(),
				'Set-Cookie': `${transactionCookieName()}=${encodeURIComponent(await createTransactionToken(transaction))}; ${cookieOptions(600)}`,
				'Cache-Control': 'no-store'
			}
		});
	} catch {
		return new Response('Synology 로그인 설정을 확인해 주세요.', { status: 500 });
	}
};
