import {
	cookieOptions,
	createSessionToken,
	readCookie,
	safeReturnTo,
	sessionCookieName,
	transactionCookieName
} from './_auth';
import { exchangeAuthorizationCode, verifyTransactionToken } from './_oidc';

export default async (request: Request) => {
	const url = new URL(request.url);
	const transactionToken = readCookie(request, transactionCookieName());
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!transactionToken || !code || !state || url.searchParams.has('error')) {
		return failure('로그인 요청이 취소되었거나 올바르지 않습니다.');
	}
	try {
		const transaction = await verifyTransactionToken(transactionToken);
		if (transaction.state !== state) return failure('로그인 state 검증에 실패했습니다.');
		const user = await exchangeAuthorizationCode(code, transaction);
		return new Response(null, {
			status: 302,
			headers: [
				['Location', new URL(safeReturnTo(transaction.returnTo), request.url).toString()],
				[
					'Set-Cookie',
					`${sessionCookieName()}=${encodeURIComponent(await createSessionToken(user))}; ${cookieOptions(8 * 60 * 60)}`
				],
				['Set-Cookie', `${transactionCookieName()}=; ${cookieOptions(0)}`],
				['Cache-Control', 'no-store']
			]
		});
	} catch {
		return failure('Synology 로그인 검증에 실패했습니다. 다시 로그인해 주세요.');
	}
};

function failure(message: string) {
	return new Response(message, {
		status: 400,
		headers: {
			'Set-Cookie': `${transactionCookieName()}=; ${cookieOptions(0)}`,
			'Cache-Control': 'no-store'
		}
	});
}
