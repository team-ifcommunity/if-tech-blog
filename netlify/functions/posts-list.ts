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

export default async (request: Request) => {
	if (request.method !== 'GET') return json({ ok: false, message: 'GET 요청만 허용됩니다.' }, 405);
	const config = getGithubConfig();
	if (!config) return json({ ok: false, message: 'GitHub 환경변수가 설정되지 않았습니다.' }, 500);
	const headers = githubHeaders(config.token);
	const directoryResponse = await fetch(
		`${contentsUrl(config.owner, config.repo)}?ref=${encodeURIComponent(config.branch)}`,
		{ headers }
	);
	const entries = await directoryResponse.json().catch(() => null);
	if (!directoryResponse.ok || !Array.isArray(entries))
		return json(
			{ ok: false, message: '게시글 목록을 불러오지 못했습니다.' },
			directoryResponse.status
		);

	const files = entries.filter((entry) => entry?.type === 'file' && isValidPostFile(entry.name));
	const posts = await Promise.all(
		files.map(async (entry) => {
			const response = await fetch(
				`${contentsUrl(config.owner, config.repo, postPath(entry.name))}?ref=${encodeURIComponent(config.branch)}`,
				{ headers }
			);
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.content) return null;
			try {
				const { frontmatter } = parseMdx(decodeGithubContent(result.content));
				return {
					file: entry.name,
					title: frontmatter.title ?? entry.name,
					description: frontmatter.description ?? '',
					category: frontmatter.category ?? '',
					author: frontmatter.author ?? '',
					pubDate: frontmatter.pubDate ?? '',
					slug: frontmatter.slug ?? ''
				};
			} catch {
				return null;
			}
		})
	);

	return json({
		ok: true,
		posts: posts
			.filter(Boolean)
			.sort((a, b) => String(b?.pubDate).localeCompare(String(a?.pubDate)))
	});
};
