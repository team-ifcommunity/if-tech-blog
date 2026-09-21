const BLOG_DIRECTORY = 'src/content/blog';

export const githubHeaders = (token: string) => ({
	Authorization: `Bearer ${token}`,
	Accept: 'application/vnd.github+json',
	'X-GitHub-Api-Version': '2022-11-28'
});

export function json(body: Record<string, unknown>, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8' }
	});
}

export function getGithubConfig() {
	const token = process.env.GITHUB_TOKEN;
	const owner = process.env.GITHUB_OWNER;
	const repo = process.env.GITHUB_REPO;
	const branch = process.env.GITHUB_BRANCH || 'main';
	return token && owner && repo ? { token, owner, repo, branch } : null;
}

export function isValidPostFile(file: string) {
	return (
		file.length > 4 &&
		file.length <= 180 &&
		file.normalize('NFC') === file &&
		/^[^\\/\u0000-\u001f\u007f]+\.mdx$/u.test(file) &&
		!file.includes('..')
	);
}

export function postPath(file: string) {
	return `${BLOG_DIRECTORY}/${file}`;
}

export function contentsUrl(owner: string, repo: string, path = BLOG_DIRECTORY) {
	const encodedPath = path.split('/').map(encodeURIComponent).join('/');
	return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
}

function parseScalar(raw: string): string | boolean {
	const value = raw.trim();
	if (value === 'true') return true;
	if (value === 'false') return false;
	if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
	if (value.startsWith('"') && value.endsWith('"')) {
		try {
			return JSON.parse(value);
		} catch {
			return value.slice(1, -1);
		}
	}
	return value;
}

export function parseMdx(source: string) {
	const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
	const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
	if (!match) throw new Error('frontmatter 형식이 올바르지 않습니다.');

	const frontmatterRaw = match[1];
	const frontmatter: Record<string, string | boolean> = {};
	for (const line of frontmatterRaw.split('\n')) {
		const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
		if (field) frontmatter[field[1]] = parseScalar(field[2]);
	}

	let rest = match[2].replace(/^\n+/, '');
	const imports: string[] = [];
	while (true) {
		const importMatch = rest.match(/^(import\s+[^\n]+;?)\n(?:\n)?/);
		if (!importMatch) break;
		imports.push(importMatch[1]);
		rest = rest.slice(importMatch[0].length);
	}

	return { frontmatter, frontmatterRaw, imports, content: rest.trim() };
}

function yamlString(value: string) {
	return `'${value.replace(/\r?\n/g, ' ').replace(/'/g, "''")}'`;
}

export function updateFrontmatter(raw: string, values: Record<string, string | boolean>) {
	const remaining = new Map(Object.entries(values));
	const lines = raw.split('\n').map((line) => {
		const field = line.match(/^([A-Za-z][\w-]*):(\s*).*/);
		if (!field || !remaining.has(field[1])) return line;
		const value = remaining.get(field[1]);
		remaining.delete(field[1]);
		return `${field[1]}:${field[2] || ' '}${typeof value === 'boolean' ? value : yamlString(value ?? '')}`;
	});
	for (const [key, value] of remaining) {
		lines.push(`${key}: ${typeof value === 'boolean' ? value : yamlString(value)}`);
	}
	return lines.join('\n');
}

export function decodeGithubContent(content: string) {
	return Buffer.from(content.replace(/\n/g, ''), 'base64').toString('utf8');
}

export async function triggerNetlifyBuild() {
	const buildHook = process.env.NETLIFY_BUILD_HOOK_URL;
	if (!buildHook) return false;

	try {
		const response = await fetch(buildHook, { method: 'POST' });
		return response.ok;
	} catch {
		return false;
	}
}
