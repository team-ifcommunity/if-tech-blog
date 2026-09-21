export default async (request: Request, context: { next: () => Promise<Response> }) => {
	const sessionResponse = await fetch(new URL('/.netlify/functions/auth-me', request.url), {
		headers: { Cookie: request.headers.get('cookie') || '', Accept: 'application/json' }
	}).catch(() => null);
	if (sessionResponse?.ok) return context.next();
	const loginUrl = new URL('/auth/login', request.url);
	const currentUrl = new URL(request.url);
	loginUrl.searchParams.set('returnTo', `${currentUrl.pathname}${currentUrl.search}`);
	return Response.redirect(loginUrl, 302);
};
