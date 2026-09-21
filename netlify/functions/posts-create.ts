import { triggerNetlifyBuild } from './_posts';

type CreatePostBody = {
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
  
  function sanitizeFileName(value: string) {
    return value
      .trim()
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, '_');
  }
  
  function escapeYamlString(value: string) {
    return value.replace(/'/g, "''");
  }

  function isValidHeroImage(value: string, category: string, slug: string) {
    const escapedCategory = category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `^/post/\\d{4}/${escapedCategory}/\\d{2}-\\d{2}/${escapedSlug}/assets/images/thumbnail\\.(?:png|jpg|jpeg|webp)$`,
    );

    return pattern.test(value);
  }
  
  export default async (request: Request) => {
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'POST 요청만 허용됩니다.',
        }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
  
    if (!token || !owner || !repo) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'GitHub 환경변수가 설정되지 않았습니다.',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  
    let body: CreatePostBody;
  
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'JSON 형식이 올바르지 않습니다.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  
    const {
      title,
      description,
      category,
      slug,
      content,
      author = 'CMS 작성자',
      isWarning = false,
      heroImage,
      pubDate: requestedPubDate,
    } = body;
  
    if (!title || !description || !category || !slug || !content || !heroImage) {
      return new Response(
        JSON.stringify({
          ok: false,
          message:
            'title, description, category, slug, content, heroImage는 필수입니다.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  
    const safeSlug = slug
      .trim()
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  
    if (!safeSlug) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'slug가 올바르지 않습니다.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (!isValidHeroImage(heroImage, category.trim().normalize('NFC'), safeSlug)) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: '먼저 썸네일을 업로드한 뒤 게시해 주세요.',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const heroImageParts = heroImage.split('/');
    const pubDate = requestedPubDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedPubDate)
      ? requestedPubDate
      : `${heroImageParts[2]}-${heroImageParts[4]}`;
  
    const fileName = `${sanitizeFileName(title)}.mdx`;
    const filePath = `src/content/blog/${fileName}`;
  
    const mdx = [
        '---',
        `title: '${escapeYamlString(title)}'`,
        `description: '${escapeYamlString(description)}'`,
        `isWarning: ${isWarning}`,
        `pubDate: '${pubDate}'`,
        `heroImage: '${heroImage}'`,
        `category: '${escapeYamlString(category)}'`,
        `author: '${escapeYamlString(author)}'`,
        `slug: '${safeSlug}'`,
        '---',
        '',
        `import AssetImage from '@/components/AssetImage.astro';`,
        '',
        content.trim(),
        '',
      ].join('\n');
  
    const checkResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
        filePath,
      ).replace(/%2F/g, '/') }?ref=${encodeURIComponent(branch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
  
    if (checkResponse.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: '같은 파일명의 게시글이 이미 존재합니다.',
          filePath,
        }),
        {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  
    if (checkResponse.status !== 404) {
      const error = await checkResponse.json();
  
      return new Response(
        JSON.stringify({
          ok: false,
          message: 'GitHub 파일 확인 중 오류가 발생했습니다.',
          github: error,
        }),
        {
          status: checkResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  
    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
        filePath,
      ).replace(/%2F/g, '/')}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `docs: ${title}`,
          content: Buffer.from(mdx, 'utf8').toString('base64'),
          branch,
        }),
      },
    );
  
    const result = await createResponse.json();
  
    if (!createResponse.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: createResponse.status,
          github: result,
        }),
        {
          status: createResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  
    const deploymentTriggered = await triggerNetlifyBuild();

    return new Response(
      JSON.stringify({
        ok: true,
        message: '게시글 MDX 생성 성공',
        filePath,
        commitSha: result.commit?.sha,
        fileUrl: result.content?.html_url,
        deploymentTriggered,
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  };
