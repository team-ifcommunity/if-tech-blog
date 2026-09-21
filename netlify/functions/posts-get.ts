import {
	contentsUrl,
	decodeGithubContent,
	getGithubConfig,
	githubHeaders,
	isValidPostFile,
	json,
	parseMdx,
	postPath
} from './_posts';
import { getStorageMode, isLocalFileStorageAllowed, readLocalPost } from './_storage';

export default async (request: Request) => {
	if (request.method !== 'GET') return json({ ok: false, message: 'GET 요청만 허용됩니다.' }, 405);
	const file = new URL(request.url).searchParams.get('file')?.normalize('NFC') ?? '';
	if (!isValidPostFile(file))
		return json({ ok: false, message: '게시글 파일 경로가 올바르지 않습니다.' }, 400);

	if (getStorageMode() === 'local') {
		if (!isLocalFileStorageAllowed())
			return json(
				{ ok: false, message: '로컬 파일 읽기는 netlify dev에서만 사용할 수 있습니다.' },
				403
			);
		try {
			const result = await readLocalPost(file);
			const parsed = parseMdx(result.source);
			return json({
				ok: true,
				storageMode: 'local',
				post: { ...parsed.frontmatter, file, sha: result.sha, content: parsed.content }
			});
		} catch (error) {
			return json(
				{
					ok: false,
					message:
						error instanceof Error && 'code' in error && error.code === 'ENOENT'
							? '게시글을 찾을 수 없습니다.'
							: '로컬 게시글을 불러오지 못했습니다.'
				},
				404
			);
		}
	}
	const config = getGithubConfig();
	if (!config) return json({ ok: false, message: 'GitHub 환경변수가 설정되지 않았습니다.' }, 500);

	const response = await fetch(
		`${contentsUrl(config.owner, config.repo, postPath(file))}?ref=${encodeURIComponent(config.branch)}`,
		{
			headers: githubHeaders(config.token)
		}
	);
	const result = await response.json().catch(() => null);
	if (!response.ok || !result?.content || !result?.sha) {
		return json(
			{
				ok: false,
				message:
					response.status === 404
						? '게시글을 찾을 수 없습니다.'
						: 'GitHub에서 게시글을 불러오지 못했습니다.'
			},
			response.status
		);
	}

	try {
		const parsed = parseMdx(decodeGithubContent(result.content));
		return json({
			ok: true,
			post: { ...parsed.frontmatter, file, sha: result.sha, content: parsed.content }
		});
	} catch (error) {
		return json(
			{ ok: false, message: error instanceof Error ? error.message : 'MDX를 해석하지 못했습니다.' },
			422
		);
	}
};
