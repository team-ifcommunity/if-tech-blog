import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { contentsUrl, githubHeaders, isValidPostFile, postPath } from './_posts';

export type StorageTarget = 'local' | 'github';

export class StorageError extends Error {
	constructor(
		message: string,
		public status = 400
	) {
		super(message);
	}
}

export function getStorageMode(): StorageTarget {
	return process.env.CMS_STORAGE_MODE === 'local' ? 'local' : 'github';
}

export function isLocalFileStorageAllowed() {
	return getStorageMode() === 'local' && process.env.NETLIFY_DEV === 'true';
}

export function resolveStorageTarget(value: unknown): StorageTarget {
	const target = value === 'local' || value === 'github' ? value : getStorageMode();
	if (target === 'local' && !isLocalFileStorageAllowed()) {
		throw new StorageError(
			'로컬 파일 저장은 CMS_STORAGE_MODE=local인 netlify dev 환경에서만 사용할 수 있습니다.',
			403
		);
	}
	return target;
}

function projectRoot() {
	return path.resolve(process.cwd());
}

function safePath(base: string, ...segments: string[]) {
	const root = path.resolve(projectRoot(), base);
	const resolved = path.resolve(root, ...segments);
	if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
		throw new StorageError('허용되지 않은 파일 경로입니다.', 400);
	}
	return resolved;
}

export function localPostFilePath(file: string) {
	if (!isValidPostFile(file)) throw new StorageError('게시글 파일 경로가 올바르지 않습니다.');
	return safePath('src/content/blog', file);
}

export function localAssetFilePath(filePath: string) {
	const normalized = filePath.replace(/\\/g, '/').normalize('NFC');
	if (
		!/^\d{4}\/[^/\u0000-\u001f\u007f]+\/\d{2}-\d{2}\/[\p{L}\p{N}-]+\/assets\/images\/[A-Za-z0-9._-]+$/u.test(
			normalized
		) ||
		normalized.includes('..')
	) {
		throw new StorageError('이미지 저장 경로가 올바르지 않습니다.');
	}
	return safePath('public/post', ...normalized.split('/'));
}

export async function readLocalPost(file: string) {
	const filePath = localPostFilePath(file);
	const source = await readFile(filePath, 'utf8');
	return { source, sha: createHash('sha256').update(source).digest('hex') };
}

export async function writeLocalPost(file: string, source: string, expectedSha?: string) {
	const filePath = localPostFilePath(file);
	if (expectedSha) {
		try {
			const current = await readLocalPost(file);
			if (current.sha !== expectedSha) {
				throw new StorageError(
					'다른 변경 사항이 먼저 저장되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
					409
				);
			}
		} catch (error) {
			if (error instanceof StorageError) throw error;
		}
	}
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, source, 'utf8');
	return createHash('sha256').update(source).digest('hex');
}

export async function listLocalPostFiles() {
	const directory = safePath('src/content/blog');
	const entries = await readdir(directory, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && isValidPostFile(entry.name))
		.map((entry) => entry.name);
}

export async function writeLocalAsset(filePath: string, bytes: Buffer) {
	const absolutePath = localAssetFilePath(filePath);
	await mkdir(path.dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, bytes);
}

function githubBlobSha(bytes: Buffer) {
	return createHash('sha1')
		.update(Buffer.from(`blob ${bytes.length}\0`))
		.update(bytes)
		.digest('hex');
}

export async function putGithubFile(options: {
	token: string;
	owner: string;
	repo: string;
	branch: string;
	filePath: string;
	bytes: Buffer;
	message: string;
	overwrite?: boolean;
}) {
	const url = contentsUrl(options.owner, options.repo, options.filePath);
	const headers = githubHeaders(options.token);
	const checkResponse = await fetch(`${url}?ref=${encodeURIComponent(options.branch)}`, {
		headers
	});
	let existingSha: string | undefined;
	if (checkResponse.ok) {
		const existing = await checkResponse.json().catch(() => null);
		existingSha = existing?.sha;
		if (existingSha === githubBlobSha(options.bytes)) {
			return { alreadyExists: true, sha: existingSha, fileUrl: existing?.html_url };
		}
		if (!options.overwrite) throw new StorageError('같은 경로의 파일이 이미 존재합니다.', 409);
	} else if (checkResponse.status !== 404) {
		throw new StorageError('GitHub 파일 확인 중 오류가 발생했습니다.', checkResponse.status);
	}

	const response = await fetch(url, {
		method: 'PUT',
		headers: { ...headers, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			message: options.message,
			content: options.bytes.toString('base64'),
			branch: options.branch,
			...(existingSha ? { sha: existingSha } : {})
		})
	});
	const result = await response.json().catch(() => null);
	if (!response.ok) throw new StorageError('GitHub에 파일을 저장하지 못했습니다.', response.status);
	return {
		alreadyExists: false,
		sha: result?.content?.sha,
		commitSha: result?.commit?.sha,
		fileUrl: result?.content?.html_url
	};
}

export async function publishReferencedLocalAssets(options: {
	token: string;
	owner: string;
	repo: string;
	branch: string;
	source: string;
}) {
	if (!isLocalFileStorageAllowed()) return [];
	const paths = new Set<string>();
	for (const match of options.source.matchAll(/\/post\/([^\s"'()<>]+\.(?:png|jpe?g|webp))/giu)) {
		paths.add(match[1].normalize('NFC'));
	}
	const published: string[] = [];
	for (const filePath of paths) {
		let absolutePath: string;
		try {
			absolutePath = localAssetFilePath(filePath);
			if (!(await stat(absolutePath)).isFile()) continue;
		} catch {
			continue;
		}
		const bytes = await readFile(absolutePath);
		await putGithubFile({
			...options,
			filePath,
			bytes,
			message: `assets: publish ${path.basename(filePath)}`,
			overwrite: true
		});
		published.push(filePath);
	}
	return published;
}

export function githubPostUrl(owner: string, repo: string, file: string) {
	return contentsUrl(owner, repo, postPath(file));
}
