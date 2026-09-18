export default async () => {
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
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  
    const path = 'cms-github-write-test.txt';
    const content = [
      'CMS GitHub write test',
      '',
      `Created at: ${new Date().toISOString()}`,
      'This file was created by a Netlify Function.',
    ].join('\n');
  
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'chore: CMS GitHub write test',
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch,
        }),
      },
    );
  
    const result = await response.json();
  
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: response.status,
          github: result,
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } 
  
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'GitHub 테스트 파일 생성 성공',
        commitSha: result.commit?.sha,
        fileUrl: result.content?.html_url,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  };