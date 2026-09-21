import { cookieOptions, sessionCookieName, transactionCookieName } from './_auth';

export default async (request: Request) =>
	new Response(null, {
		status: 302,
		headers: [
			['Location', new URL('/', request.url).toString()],
			['Set-Cookie', `${sessionCookieName()}=; ${cookieOptions(0)}`],
			['Set-Cookie', `${transactionCookieName()}=; ${cookieOptions(0)}`],
			['Set-Cookie', `iftech_cms_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`],
			['Cache-Control', 'no-store']
		]
	});
