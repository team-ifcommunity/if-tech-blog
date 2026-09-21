import { getAuthMode, getSessionUser } from './_auth';
import { json } from './_posts';

export default async (request: Request) => {
	if (request.method !== 'GET') return json({ ok: false, message: 'GET 요청만 허용됩니다.' }, 405);
	const user = await getSessionUser(request);
	if (!user) return json({ ok: false, message: '로그인이 필요합니다.' }, 401);
	return json({ ok: true, mode: getAuthMode(), authorLocked: getAuthMode() === 'synology', user });
};
