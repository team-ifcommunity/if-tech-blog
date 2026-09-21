import { getStorageMode, isLocalFileStorageAllowed } from './_storage';
import { json } from './_posts';
import { requireAuth } from './_auth';

export default async (request: Request) => {
	if (request.method !== 'GET') return json({ ok: false, message: 'GET 요청만 허용됩니다.' }, 405);
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;
	return json({
		ok: true,
		mode: getStorageMode(),
		localStorageAvailable: isLocalFileStorageAllowed()
	});
};
