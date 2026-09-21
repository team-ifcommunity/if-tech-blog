import {
	decodeGithubContent,
	getGithubConfig,
	githubHeaders,
	isValidPostFile,
	json,
	parseMdx,
	triggerNetlifyBuild,
	updateFrontmatter
} from './_posts';
import {
	githubPostUrl,
	publishReferencedLocalAssets,
	putGithubFile,
	readLocalPost,
	resolveStorageTarget,
	StorageError,
	type StorageTarget,
	writeLocalPost
} from './_storage';
import { getAuthMode, requireAuth } from './_auth';

type UpdateBody = {
	target?: 'local' | 'github';
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
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;
	let body: UpdateBody;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, message: 'JSON 형식이 올바르지 않습니다.' }, 400);
	}
	if (getAuthMode() === 'synology') body.author = auth.user.name;
	let target: StorageTarget;
	try {
		target = resolveStorageTarget(body.target);
	} catch (error) {
		return storageError(error);
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

	try {
		let existingSource: string;
		if (target === 'local') existingSource = (await readLocalPost(file)).source;
		else {
			const config = getGithubConfig();
			if (!config)
				return json({ ok: false, message: 'GitHub 환경변수가 설정되지 않았습니다.' }, 500);
			const response = await fetch(
				`${githubPostUrl(config.owner, config.repo, file)}?ref=${encodeURIComponent(config.branch)}`,
				{ headers: githubHeaders(config.token) }
			);
			const current = await response.json().catch(() => null);
			if (!response.ok || !current?.content)
				return json(
					{ ok: false, message: '수정할 게시글을 GitHub에서 불러오지 못했습니다.' },
					response.status
				);
			existingSource = decodeGithubContent(current.content);
		}
		const parsed = parseMdx(existingSource);
		const existingAuthor =
			typeof parsed.frontmatter.author === 'string' ? parsed.frontmatter.author.trim() : '';
		const frontmatter = updateFrontmatter(parsed.frontmatterRaw, {
			title: body.title!.trim(),
			description: body.description!.trim(),
			isWarning: Boolean(body.isWarning),
			pubDate: body.pubDate!,
			heroImage: body.heroImage!.trim(),
			category: body.category!.trim(),
			author: getAuthMode() === 'synology' ? existingAuthor || auth.user.name : body.author!.trim(),
			slug: body.slug!.trim().normalize('NFC').toLowerCase()
		});
		const imports = parsed.imports.length
			? parsed.imports
			: ["import AssetImage from '@/components/AssetImage.astro';"];
		const source = `---\n${frontmatter}\n---\n\n${imports.join('\n')}\n\n${body.content!.trim()}\n`;
		if (target === 'local') {
			const sha = await writeLocalPost(file, source, body.sha);
			return json({ ok: true, target, message: '로컬 게시글 수정 성공', file, sha });
		}
		const config = getGithubConfig()!;
		await publishReferencedLocalAssets({
			token: config.token,
			owner: process.env.GITHUB_ASSETS_OWNER || 'team-ifcommunity',
			repo: process.env.GITHUB_ASSETS_REPO || 'if-tech-blog-assets',
			branch: process.env.GITHUB_ASSETS_BRANCH || 'main',
			source
		});
		const result = await putGithubFile({
			...config,
			filePath: `src/content/blog/${file}`,
			bytes: Buffer.from(source, 'utf8'),
			message: `docs: ${body.title!.trim()} 수정`,
			overwrite: true
		});
		const deploymentTriggered = await triggerNetlifyBuild();
		return json({
			ok: true,
			target,
			message: '게시글 수정 성공',
			file,
			sha: result.sha,
			commitSha: result.commitSha,
			deploymentTriggered
		});
	} catch (error) {
		return storageError(error);
	}
};

function storageError(error: unknown) {
	if (error instanceof StorageError)
		return json({ ok: false, message: error.message }, error.status);
	if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
		return json({ ok: false, message: '수정할 게시글을 찾을 수 없습니다.' }, 404);
	return json({ ok: false, message: '게시글을 저장하지 못했습니다.' }, 500);
}
