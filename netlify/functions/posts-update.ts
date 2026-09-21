import {
	contentsUrl,
	decodeGithubContent,
	getGithubConfig,
	githubHeaders,
	isValidPostFile,
	json,
	parseMdx,
	postPath,
	triggerNetlifyBuild,
	updateFrontmatter
} from './_posts';

type UpdateBody = {
	file?: string;
	sha?: string;
	title?: string;
	description?: string;
	category?: string;
	author?: string;
	pubDate?: string;
	heroImage?: string;
	slug?: string;
	isWarning?: boolean;
	content?: string;
};

export default async (request: Request) => {
	if (request.method !== 'PUT') return json({ ok: false, message: 'PUT 요청만 허용됩니다.' }, 405);
	const config = getGithubConfig();
	if (!config) return json({ ok: false, message: 'GitHub 환경변수가 설정되지 않았습니다.' }, 500);
	let body: UpdateBody;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, message: 'JSON 형식이 올바르지 않습니다.' }, 400);
	}

	const file = typeof body.file === 'string' ? body.file.normalize('NFC') : '';
	if (!isValidPostFile(file))
		return json({ ok: false, message: '게시글 파일 경로가 올바르지 않습니다.' }, 400);
	const required = [
		'title',
		'description',
		'category',
		'author',
		'pubDate',
		'heroImage',
		'slug',
		'content'
	] as const;
	if (required.some((key) => typeof body[key] !== 'string' || !body[key]?.trim()))
		return json({ ok: false, message: '필수 항목을 모두 입력해 주세요.' }, 400);
	if (
		!/^\d{4}-\d{2}-\d{2}$/.test(body.pubDate!) ||
		!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(body.slug!)
	)
		return json({ ok: false, message: '게시일 또는 URL 이름 형식이 올바르지 않습니다.' }, 400);

	const path = postPath(file);
	const url = contentsUrl(config.owner, config.repo, path);
	const headers = githubHeaders(config.token);
	const currentResponse = await fetch(`${url}?ref=${encodeURIComponent(config.branch)}`, {
		headers
	});
	const current = await currentResponse.json().catch(() => null);
	if (!currentResponse.ok || !current?.content || !current?.sha)
		return json(
			{ ok: false, message: '수정할 게시글을 불러오지 못했습니다.' },
			currentResponse.status
		);
	if (!body.sha || body.sha !== current.sha)
		return json(
			{
				ok: false,
				message: '다른 변경 사항이 먼저 저장되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.'
			},
			409
		);

	let parsed;
	try {
		parsed = parseMdx(decodeGithubContent(current.content));
	} catch {
		return json({ ok: false, message: '기존 MDX를 해석하지 못했습니다.' }, 422);
	}
	const frontmatter = updateFrontmatter(parsed.frontmatterRaw, {
		title: body.title!.trim(),
		description: body.description!.trim(),
		isWarning: Boolean(body.isWarning),
		pubDate: body.pubDate!,
		heroImage: body.heroImage!.trim(),
		category: body.category!.trim(),
		author: body.author!.trim(),
		slug: body.slug!.trim().normalize('NFC').toLowerCase()
	});
	const imports = parsed.imports.length
		? parsed.imports
		: ["import AssetImage from '@/components/AssetImage.astro';"];
	const source = `---\n${frontmatter}\n---\n\n${imports.join('\n')}\n\n${body.content!.trim()}\n`;
	const updateResponse = await fetch(url, {
		method: 'PUT',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			message: `docs: ${body.title!.trim()} 수정`,
			content: Buffer.from(source, 'utf8').toString('base64'),
			sha: current.sha,
			branch: config.branch
		})
	});
	const result = await updateResponse.json().catch(() => null);
	if (!updateResponse.ok)
		return json(
			{ ok: false, message: 'GitHub에 변경 사항을 저장하지 못했습니다.', github: result },
			updateResponse.status
		);
	const deploymentTriggered = await triggerNetlifyBuild();
	return json({
		ok: true,
		message: '게시글 수정 성공',
		file,
		sha: result?.content?.sha,
		commitSha: result?.commit?.sha,
		deploymentTriggered
	});
};
