const MAX_FILE_SIZE = 3 * 1024 * 1024;

const ALLOWED_FILE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
} as const;

type AllowedExtension = keyof typeof ALLOWED_FILE_TYPES;

type ImageUploadBody = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  category: string;
  slug: string;
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function getSeoulDateParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return { year: value('year'), month: value('month'), day: value('day') };
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

function isValidSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function normalizeCategory(value: string) {
  return value.trim().normalize('NFC');
}

function isValidCategory(value: string) {
  return (
    value.length > 0 &&
    value.length <= 60 &&
    !/[\\/\u0000-\u001f\u007f]/.test(value) &&
    value !== '.' &&
    value !== '..'
  );
}

function getExtension(fileName: string): AllowedExtension | null {
  const match = fileName.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  const extension = match?.[1] as AllowedExtension | undefined;

  return extension && extension in ALLOWED_FILE_TYPES ? extension : null;
}

function hasValidSignature(bytes: Buffer, extension: AllowedExtension) {
  if (extension === 'png') {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }

  if (extension === 'jpg' || extension === 'jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  return (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  );
}

function githubContentUrl(owner: string, repo: string, filePath: string) {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;
}

export default async (request: Request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, message: 'POST 요청만 허용됩니다.' }, 405);
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !owner || !repo) {
    return jsonResponse({ ok: false, message: 'GitHub 환경변수가 설정되지 않았습니다.' }, 500);
  }

  let body: ImageUploadBody;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: 'JSON 형식이 올바르지 않습니다.' }, 400);
  }

  const fileName = typeof body.fileName === 'string' ? body.fileName : '';
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.toLowerCase() : '';
  const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64 : '';
  const category = normalizeCategory(typeof body.category === 'string' ? body.category : '');
  const slug = normalizeSlug(typeof body.slug === 'string' ? body.slug : '');
  const extension = getExtension(fileName);

  if (!extension || ALLOWED_FILE_TYPES[extension] !== mimeType) {
    return jsonResponse(
      { ok: false, message: 'png, jpg, jpeg, webp 형식의 이미지만 업로드할 수 있습니다.' },
      400,
    );
  }

  if (!isValidCategory(category)) {
    return jsonResponse({ ok: false, message: '카테고리 값이 올바르지 않습니다.' }, 400);
  }

  if (!isValidSlug(slug)) {
    return jsonResponse(
      { ok: false, message: 'URL 이름은 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.' },
      400,
    );
  }

  if (!contentBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) {
    return jsonResponse({ ok: false, message: '이미지 데이터가 올바르지 않습니다.' }, 400);
  }

  const fileBytes = Buffer.from(contentBase64, 'base64');

  if (fileBytes.length === 0 || fileBytes.length > MAX_FILE_SIZE) {
    return jsonResponse({ ok: false, message: '이미지 크기는 3MB 이하여야 합니다.' }, 413);
  }

  if (!hasValidSignature(fileBytes, extension)) {
    return jsonResponse(
      { ok: false, message: '파일 내용과 이미지 형식이 일치하지 않습니다.' },
      400,
    );
  }

  const { year, month, day } = getSeoulDateParts();
  const filePath = `public/post/${year}/${category}/${month}-${day}/${slug}/assets/images/thumbnail.${extension}`;
  const imagePath = `/post/${year}/${category}/${month}-${day}/${slug}/assets/images/thumbnail.${extension}`;
  const contentUrl = githubContentUrl(owner, repo, filePath);
  const githubHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const checkResponse = await fetch(`${contentUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders,
  });

  if (checkResponse.ok) {
    return jsonResponse(
      {
        ok: true,
        alreadyExists: true,
        message: '같은 경로의 썸네일이 이미 있어 기존 이미지를 사용합니다.',
        filePath,
        imagePath,
      },
      200,
    );
  }

  if (checkResponse.status !== 404) {
    const github = await checkResponse.json().catch(() => null);
    return jsonResponse(
      { ok: false, message: 'GitHub 이미지 확인 중 오류가 발생했습니다.', github },
      checkResponse.status,
    );
  }

  const createResponse = await fetch(contentUrl, {
    method: 'PUT',
    headers: { ...githubHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `assets: add thumbnail for ${slug}`,
      content: contentBase64,
      branch,
    }),
  });
  const result = await createResponse.json().catch(() => null);

  if (!createResponse.ok) {
    return jsonResponse(
      { ok: false, message: 'GitHub에 이미지를 저장하지 못했습니다.', github: result },
      createResponse.status,
    );
  }

  return jsonResponse(
    {
      ok: true,
      message: '썸네일 업로드 성공',
      filePath,
      imagePath,
      commitSha: result?.commit?.sha,
      fileUrl: result?.content?.html_url,
    },
    201,
  );
};
