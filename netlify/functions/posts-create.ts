import { getGithubConfig, isValidPostFile, json, triggerNetlifyBuild } from './_posts';
import { getAuthMode, requireAuth } from './_auth';
import {
	publishReferencedLocalAssets,
	putGithubFile,
	readLocalPost,
	resolveStorageTarget,
	StorageError,
	type StorageTarget,
	writeLocalPost
} from './_storage';

type CreatePostBody = {
	target?: 'local' | 'github';
	file?: string;
	sha?: string;
	title: string;
	description: string;
	category: string;
	slug: string;
	content: string;
	author?: string;
	isWarning?: boolean;
	heroImage: string;
	pubDate?: string;
};
const sanitizeFileName = (value: string) =>
	value
		.trim()
		.replace(/[\\/:*?"<>|]/g, '')
		.replace(/\s+/g, '_');
const escapeYamlString = (value: string) => value.replace(/'/g, "''");

function isValidHeroImage(value: string, category: string, slug: string) {
	const escape = (part: string) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(
		`^/post/\\d{4}/${escape(category)}/\\d{2}-\\d{2}/${escape(slug)}/assets/images/thumbnail\\.(?:png|jpg|jpeg|webp)$`
	).test(value);
}

export default async (request: Request) => {
	if (request.method !== 'POST')
		return json({ ok: false, message: 'POST 요청만 허용됩니다.' }, 405);
	const auth = await requireAuth(request);
	if ('response' in auth) return auth.response;
	let body: CreatePostBody;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, message: 'JSON 형식이 올바르지 않습니다.' }, 400);
	}
	let target: StorageTarget;
	try {
		target = resolveStorageTarget(body.target);
	} catch (error) {
		return storageError(error);
	}

	const title = body.title?.trim();
	const description = body.description?.trim();
	const category = body.category?.trim().normalize('NFC');
	const author =
		getAuthMode() === 'synology' ? auth.user.name : body.author?.trim() || auth.user.name;
	const content = body.content?.trim();
	const heroImage = body.heroImage?.trim();
	const safeSlug = body.slug?.trim().normalize('NFC').toLowerCase();
	if (!title || !description || !category || !safeSlug || !content || !heroImage)
		return json({ ok: false, message: '필수 항목을 모두 입력해 주세요.' }, 400);
	if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(safeSlug))
		return json({ ok: false, message: 'slug가 올바르지 않습니다.' }, 400);
	if (!isValidHeroImage(heroImage, category, safeSlug))
		return json({ ok: false, message: '먼저 썸네일을 업로드한 뒤 저장해 주세요.' }, 400);

	const heroImageParts = heroImage.split('/');
	const pubDate =
		body.pubDate && /^\d{4}-\d{2}-\d{2}$/.test(body.pubDate)
			? body.pubDate
			: `${heroImageParts[2]}-${heroImageParts[4]}`;
	const requestedFile = typeof body.file === 'string' ? body.file.normalize('NFC') : '';
	const file =
		requestedFile && isValidPostFile(requestedFile)
			? requestedFile
			: `${sanitizeFileName(title)}.mdx`;
	const source = [
		'---',
		`title: '${escapeYamlString(title)}'`,
		`description: '${escapeYamlString(description)}'`,
		`isWarning: ${Boolean(body.isWarning)}`,
		`pubDate: '${pubDate}'`,
		`heroImage: '${heroImage}'`,
		`category: '${escapeYamlString(category)}'`,
		`author: '${escapeYamlString(author)}'`,
		`slug: '${safeSlug}'`,
		'---',
		'',
		`import AssetImage from '@/components/AssetImage.astro';`,
		'',
		content,
		''
	].join('\n');

	try {
		if (target === 'local') {
			if (!requestedFile) {
				try {
					await readLocalPost(file);
					throw new StorageError('같은 파일명의 게시글이 이미 존재합니다.', 409);
				} catch (error) {
					if (error instanceof StorageError) throw error;
				}
			}
			const sha = await writeLocalPost(file, source, requestedFile ? body.sha : undefined);
			return json(
				{
					ok: true,
					target,
					message: '로컬 게시글 저장 성공',
					file,
					filePath: `src/content/blog/${file}`,
					sha
				},
				201
			);
		}
		const config = getGithubConfig();
		if (!config) return json({ ok: false, message: 'GitHub 환경변수가 설정되지 않았습니다.' }, 500);
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
			message: `docs: ${title}`,
			overwrite: false
		});
		const deploymentTriggered = await triggerNetlifyBuild();
		return json(
			{
				ok: true,
				target,
				message: '게시글 MDX 생성 성공',
				file,
				filePath: `src/content/blog/${file}`,
				commitSha: result.commitSha,
				fileUrl: result.fileUrl,
				deploymentTriggered
			},
			201
		);
	} catch (error) {
		return storageError(error);
	}
};

function storageError(error: unknown) {
	return error instanceof StorageError
		? json({ ok: false, message: error.message }, error.status)
		: json({ ok: false, message: '게시글을 저장하지 못했습니다.' }, 500);
}
