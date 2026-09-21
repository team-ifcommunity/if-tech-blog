import { randomBytes } from 'node:crypto';
import { json } from './_posts';
import { putGithubFile, resolveStorageTarget, StorageError, writeLocalAsset } from './_storage';

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_FILE_TYPES = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp'
} as const;
type AllowedExtension = keyof typeof ALLOWED_FILE_TYPES;
type ImageUploadBody = {
	target?: 'local' | 'github';
	type?: 'thumbnail' | 'content';
	fileName: string;
	mimeType: string;
	contentBase64: string;
	category: string;
	slug: string;
	pubDate?: string;
	overwrite?: boolean;
};

function seoulDate() {
	const values = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Seoul',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
			.formatToParts(new Date())
			.map((part) => [part.type, part.value])
	);
	return { year: values.year, month: values.month, day: values.day };
}

function dateParts(value?: string) {
	const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	return match ? { year: match[1], month: match[2], day: match[3] } : seoulDate();
}

function hasValidSignature(bytes: Buffer, extension: AllowedExtension) {
	if (extension === 'png')
		return (
			bytes.length >= 8 &&
			bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		);
	if (extension === 'jpg' || extension === 'jpeg')
		return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	return (
		bytes.length >= 12 &&
		bytes.toString('ascii', 0, 4) === 'RIFF' &&
		bytes.toString('ascii', 8, 12) === 'WEBP'
	);
}

export default async (request: Request) => {
	if (request.method !== 'POST')
		return json({ ok: false, message: 'POST 요청만 허용됩니다.' }, 405);
	let body: ImageUploadBody;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, message: 'JSON 형식이 올바르지 않습니다.' }, 400);
	}
	let target;
	try {
		target = resolveStorageTarget(body.target);
	} catch (error) {
		return storageError(error);
	}

	const uploadType = body.type ?? 'thumbnail';
	if (uploadType !== 'thumbnail' && uploadType !== 'content')
		return json({ ok: false, message: '이미지 업로드 유형이 올바르지 않습니다.' }, 400);
	const category = typeof body.category === 'string' ? body.category.trim().normalize('NFC') : '';
	const slug = typeof body.slug === 'string' ? body.slug.trim().normalize('NFC').toLowerCase() : '';
	if (
		!category ||
		category.length > 60 ||
		/[\\/\u0000-\u001f\u007f]/.test(category) ||
		category === '.' ||
		category === '..'
	)
		return json({ ok: false, message: '카테고리 값이 올바르지 않습니다.' }, 400);
	if (!/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug))
		return json(
			{ ok: false, message: 'URL 이름에는 문자, 숫자, 하이픈(-)만 사용할 수 있습니다.' },
			400
		);

	const extension = body.fileName
		?.trim()
		.toLowerCase()
		.match(/\.([a-z0-9]+)$/)?.[1] as AllowedExtension | undefined;
	const mimeType = body.mimeType?.toLowerCase();
	if (
		!extension ||
		!(extension in ALLOWED_FILE_TYPES) ||
		ALLOWED_FILE_TYPES[extension] !== mimeType
	)
		return json(
			{ ok: false, message: 'png, jpg, jpeg, webp 형식의 이미지만 업로드할 수 있습니다.' },
			400
		);
	if (!body.contentBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.contentBase64))
		return json({ ok: false, message: '이미지 데이터가 올바르지 않습니다.' }, 400);
	const bytes = Buffer.from(body.contentBase64, 'base64');
	if (!bytes.length || bytes.length > MAX_FILE_SIZE)
		return json({ ok: false, message: '이미지 크기는 3MB 이하여야 합니다.' }, 413);
	if (!hasValidSignature(bytes, extension))
		return json({ ok: false, message: '파일 내용과 이미지 형식이 일치하지 않습니다.' }, 400);

	const { year, month, day } = dateParts(body.pubDate);
	const storedFileName =
		uploadType === 'thumbnail'
			? `thumbnail.${extension}`
			: `image-${Date.now()}-${randomBytes(4).toString('hex')}.${extension}`;
	const filePath = `${year}/${category}/${month}-${day}/${slug}/assets/images/${storedFileName}`;
	const imagePath = `/post/${filePath}`;

	try {
		if (target === 'local') {
			await writeLocalAsset(filePath, bytes);
			return json(
				{
					ok: true,
					target,
					type: uploadType,
					message:
						uploadType === 'thumbnail' ? '로컬 썸네일 저장 성공' : '로컬 본문 이미지 저장 성공',
					filePath,
					imagePath
				},
				201
			);
		}
		const token = process.env.GITHUB_TOKEN;
		if (!token)
			return json({ ok: false, message: 'GitHub Assets 환경변수가 설정되지 않았습니다.' }, 500);
		const result = await putGithubFile({
			token,
			owner: process.env.GITHUB_ASSETS_OWNER || 'team-ifcommunity',
			repo: process.env.GITHUB_ASSETS_REPO || 'if-tech-blog-assets',
			branch: process.env.GITHUB_ASSETS_BRANCH || 'main',
			filePath,
			bytes,
			message:
				uploadType === 'thumbnail'
					? `assets: add thumbnail for ${slug}`
					: `assets: add content image for ${slug}`,
			overwrite: uploadType === 'thumbnail' && Boolean(body.overwrite)
		});
		return json(
			{
				ok: true,
				target,
				type: uploadType,
				message: uploadType === 'thumbnail' ? '썸네일 업로드 성공' : '본문 이미지 업로드 성공',
				filePath,
				imagePath,
				alreadyExists: result.alreadyExists,
				commitSha: result.commitSha,
				fileUrl: result.fileUrl
			},
			result.alreadyExists ? 200 : 201
		);
	} catch (error) {
		return storageError(error);
	}
};

function storageError(error: unknown) {
	return error instanceof StorageError
		? json({ ok: false, message: error.message }, error.status)
		: json({ ok: false, message: '이미지를 저장하지 못했습니다.' }, 500);
}
