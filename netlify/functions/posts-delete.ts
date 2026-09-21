import {
	contentsUrl,
	decodeGithubContent,
	getGithubConfig,
	githubHeaders,
	isValidPostFile,
	json,
	parseMdx,
	postPath,
	triggerNetlifyBuild
} from './_posts';
import {
	deleteLocalPost,
	githubPostUrl,
	postAssetDirectory,
	readLocalPost,
	resolveStorageTarget,
	StorageError,
	type StorageTarget
} from './_storage';

type DeletePostBody = {
	target?: StorageTarget;
	file?: string;
	confirmation?: string;
};

type GithubConfig = NonNullable<ReturnType<typeof getGithubConfig>>;

export default async (request: Request) => {
	if (request.method !== 'DELETE')
		return json({ ok: false, message: 'DELETE 요청만 허용됩니다.' }, 405);

	let body: DeletePostBody;
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
	const file = typeof body.file === 'string' ? body.file.normalize('NFC') : '';
	if (!isValidPostFile(file) || body.confirmation !== file)
		return json({ ok: false, message: '삭제 확인 정보가 올바르지 않습니다.' }, 400);

	try {
		if (target === 'local') {
			const { source } = await readLocalPost(file);
			const assetDirectory = postAssetDirectory(parseMdx(source).frontmatter);
			await deleteLocalPost(file, assetDirectory);
			return json({
				ok: true,
				target,
				message: '로컬 게시글과 자산을 삭제했습니다.',
				file,
				assetDirectory: `public/post/${assetDirectory}/`
			});
		}

		const config = getGithubConfig();
		if (!config) return json({ ok: false, message: 'GitHub 환경변수가 설정되지 않았습니다.' }, 500);
		const current = await getGithubPost(config, file);
		const assetDirectory = postAssetDirectory(parseMdx(current.source).frontmatter);
		await deleteGithubFile(config, postPath(file), current.sha, `docs: ${file} 삭제`);

		let deletedAssetCount = 0;
		let assetCleanupError: string | undefined;
		try {
			deletedAssetCount = await deleteGithubAssetDirectory(assetDirectory);
		} catch (error) {
			assetCleanupError =
				error instanceof Error ? error.message : 'GitHub 자산 폴더를 정리하지 못했습니다.';
		}
		const deploymentTriggered = await triggerNetlifyBuild();
		if (assetCleanupError) {
			return json(
				{
					ok: false,
					target,
					message: `게시글은 삭제했지만 자산 정리에 실패했습니다. ${assetCleanupError}`,
					file,
					postDeleted: true,
					deploymentTriggered
				},
				502
			);
		}
		return json({
			ok: true,
			target,
			message: 'GitHub 게시글과 자산을 삭제했습니다.',
			file,
			assetDirectory,
			deletedAssetCount,
			deploymentTriggered
		});
	} catch (error) {
		return storageError(error);
	}
};

async function getGithubPost(config: GithubConfig, file: string) {
	const response = await fetch(
		`${githubPostUrl(config.owner, config.repo, file)}?ref=${encodeURIComponent(config.branch)}`,
		{ headers: githubHeaders(config.token) }
	);
	const result = await response.json().catch(() => null);
	if (!response.ok || !result?.content || !result?.sha) {
		throw new StorageError(
			response.status === 404
				? '삭제할 게시글을 GitHub에서 찾을 수 없습니다.'
				: 'GitHub 게시글을 확인하지 못했습니다.',
			response.status
		);
	}
	return { source: decodeGithubContent(result.content), sha: String(result.sha) };
}

async function deleteGithubFile(
	config: GithubConfig,
	filePath: string,
	sha: string,
	message: string
) {
	const response = await fetch(contentsUrl(config.owner, config.repo, filePath), {
		method: 'DELETE',
		headers: { ...githubHeaders(config.token), 'Content-Type': 'application/json' },
		body: JSON.stringify({ message, sha, branch: config.branch })
	});
	if (!response.ok) throw new StorageError('GitHub 게시글을 삭제하지 못했습니다.', response.status);
}

async function deleteGithubAssetDirectory(assetDirectory: string) {
	const token = process.env.GITHUB_TOKEN;
	const owner = process.env.GITHUB_ASSETS_OWNER || 'team-ifcommunity';
	const repo = process.env.GITHUB_ASSETS_REPO || 'if-tech-blog-assets';
	const branch = process.env.GITHUB_ASSETS_BRANCH || 'main';
	if (!token) throw new StorageError('GitHub 토큰이 설정되지 않았습니다.', 500);
	const headers = githubHeaders(token);
	const branchResponse = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`,
		{ headers }
	);
	const branchResult = await branchResponse.json().catch(() => null);
	if (!branchResponse.ok || !branchResult?.object?.sha)
		throw new StorageError('assets 저장소 브랜치를 확인하지 못했습니다.', branchResponse.status);

	const commitSha = String(branchResult.object.sha);
	const commitResponse = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(commitSha)}`,
		{ headers }
	);
	const commitResult = await commitResponse.json().catch(() => null);
	if (!commitResponse.ok || !commitResult?.tree?.sha)
		throw new StorageError('assets 저장소 tree를 확인하지 못했습니다.', commitResponse.status);

	const treeResponse = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(commitResult.tree.sha)}?recursive=1`,
		{ headers }
	);
	const treeResult = await treeResponse.json().catch(() => null);
	if (!treeResponse.ok || !Array.isArray(treeResult?.tree))
		throw new StorageError('assets 저장소 파일 목록을 불러오지 못했습니다.', treeResponse.status);
	if (treeResult.truncated)
		throw new StorageError('assets 저장소 파일 목록이 너무 커서 안전하게 삭제할 수 없습니다.', 409);

	const prefix = `${assetDirectory}/`;
	const files = treeResult.tree.filter(
		(entry: { path?: unknown; type?: unknown }) =>
			entry.type === 'blob' && typeof entry.path === 'string' && entry.path.startsWith(prefix)
	);
	if (!files.length) return 0;
	const createTreeResponse = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
		{
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				base_tree: commitResult.tree.sha,
				tree: files.map((entry: { path: string; mode: string; type: string }) => ({
					path: entry.path,
					mode: entry.mode,
					type: entry.type,
					sha: null
				}))
			})
		}
	);
	const createdTree = await createTreeResponse.json().catch(() => null);
	if (!createTreeResponse.ok || !createdTree?.sha)
		throw new StorageError('assets 삭제 tree를 만들지 못했습니다.', createTreeResponse.status);

	const createCommitResponse = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
		{
			method: 'POST',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				message: `assets: ${assetDirectory} 삭제`,
				tree: createdTree.sha,
				parents: [commitSha]
			})
		}
	);
	const createdCommit = await createCommitResponse.json().catch(() => null);
	if (!createCommitResponse.ok || !createdCommit?.sha)
		throw new StorageError('assets 삭제 커밋을 만들지 못했습니다.', createCommitResponse.status);

	const updateRefResponse = await fetch(
		`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
		{
			method: 'PATCH',
			headers: { ...headers, 'Content-Type': 'application/json' },
			body: JSON.stringify({ sha: createdCommit.sha, force: false })
		}
	);
	if (!updateRefResponse.ok)
		throw new StorageError('assets 삭제 커밋을 반영하지 못했습니다.', updateRefResponse.status);
	return files.length;
}

function storageError(error: unknown) {
	if (error instanceof StorageError)
		return json({ ok: false, message: error.message }, error.status || 500);
	if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
		return json({ ok: false, message: '삭제할 게시글을 찾을 수 없습니다.' }, 404);
	return json({ ok: false, message: '게시글을 삭제하지 못했습니다.' }, 500);
}
