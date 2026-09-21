import { getStorageMode, isLocalFileStorageAllowed } from './_storage';
import { json } from './_posts';

export default async (request: Request) => {
	if (request.method !== 'GET') return json({ ok: false, message: 'GET 요청만 허용됩니다.' }, 405);
	return json({
		ok: true,
		mode: getStorageMode(),
		localStorageAvailable: isLocalFileStorageAllowed()
	});
};
