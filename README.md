# ✍️ 이프커뮤니티 기술 블로그

<h2 id="목차">🔢 목차</h2>

- [❓ 이프커뮤니티 기술 블로그가 무엇인가요?](#이프커뮤니티-기술-블로그가-무엇인가요)
- [🗂️ 폴더 구조](#폴더-구조)
- [🛠️ 이프커뮤니티 기술 블로그 사용법](#이프커뮤니티-기술-블로그-사용법)
  - [✏️ 아티클 작성하기 (개발자)](<#아티클-작성하기-(개발자)>)
  - [✏️ 아티클 작성하기 (개발자가 아닌경우)](#아티클-작성하기-개발자가-아닌경우)
  - [🌟 Netlify 배포 트리거가 필요한 경우](#Netlify-배포-트리거가-필요한-경우)
- [🗃️ if-tech-blog / if-tech-blog-assets 저장소 관계](#if-tech-blog-/-if-tech-blog-assets-저장소-관계)
- [🎖️ License](#License)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

<br/><br/>

<h2 id="이프커뮤니티-기술-블로그가-무엇인가요">❓이프커뮤니티 기술 블로그가 무엇인가요?</h2>

이프커뮤니티 기술 블로그는 개발 과정에서 얻은 기술 지식, 트러블슈팅 경험, 아키텍처/운영 노하우를 기록하고 공유하는 공간입니다.

주요 목적은 다음과 같습니다.

- 팀 내 기술 자산 축적 및 재사용
- 문제 해결 과정의 문서화
- 신규 구성원 온보딩 지원
- 외부 개발자 커뮤니케이션(브랜딩)

---

<h2 id="폴더-구조">🗂️ 폴더 구조</h2>

폴더 구조에 대해 간략하게 설명합니다. 개발자가 아니라면, 이 설명은 건너뛰어도 좋습니다.

- `public`: 정적인 리소스 (이미지, 아이콘, 기타 라이브러리 코드) 를 관리합니다.

- `scripts`: 작업 편의성을 위해 만든 명령어 코드들을 관리합니다.

- `src > components`: 재활용되는 컴포넌트 파일들을 관리합니다.

- `src > content > blog`: 마크다운 파일을 관리하는 디렉토리로, 여기에 생성된 `.mdx` 파일들이 곧 페이지에 표시 될 아티클이 됩니다.

- `src > layouts`: 블로그의 레이아웃을 구성하는 컴포넘트 파일들을 관리합니다.

- `src > pages`: URL 및 페이지를 표시하기 위한 파일들을 관리합니다. `Astro` 는 `Next.js`처럼 파일 기반 라우팅을 지원합니다.

---

<h2 id="이프커뮤니티-기술-블로그-사용법">🛠️ 이프커뮤니티 기술 블로그 사용법</h2>

아래는 기술 블로그 사용법 (개발자 기준) 에 대한 설명입니다.
개발자가 아니거나, 설명을 이해하기 힘들다면 아래 섹션으로 이동하세요.

<a href="#아티클-작성하기-개발자가-아닌경우">아티클 작성하기 개발자가 아닌경우 &gt;</a>

<br/>

<h2 id="아티클-작성하기-(개발자)">✏️ 아티클 작성하기 (개발자)</h2>

1. **블로그 repo에서 글 작성**
   - `if-tech-blog` 레포지토리에서 `src > content > blog` 폴더 안에 `파일명.mdx` 파일을 만들어서 안에 내용을 작성합니다.

2. **포스트 프리셋 스크립트 실행**
   - 글에 이미지나 비디오같은게 들어간다면, 아래 스크립트를 실행하세요. public 폴더 안에 저장을 위한 폴더구조가 자동으로 생성됩니다.

   ```bash
   npm run post:preset
   ```

   특정 글만 처리하고 싶다면 파일명(또는 상대경로)을 인자로 넘길 수 있습니다.

   ```bash
   npm run post:preset -- my-post.mdx
   npm run post:preset -- category/my-post.mdx
   ```

3. **이미지 저장 경로 규칙 준수**
   - 포스트 이미지 파일은 아래 경로에 저장됩니다. `.mdx` 파일의 frontmatter에 적힌 정보 (pubDate, category 등) 를 기준으로 가져오기 때문에, 2026이 아닌 2027이 될 수도 있습니다.

   ```
   public/post/2026/.../assets/images/*
   ```

4. **assets repo에 이미지 자산 반영 및 푸시**
   - 이미지(정적 자산)만 별도 저장소(`if-tech-blog-assets`)에 반영합니다.

   ```bash
   cd public/post
   git add .
   git commit -m "assets: add images for <post>"
   git push
   cd ../..
   ```

5. **블로그 repo 변경사항 커밋/푸시**
   - 본문/메타 변경사항은 `if-tech-blog` 저장소에서 커밋하고 푸시합니다.

<br/>

<h2 id="아티클-작성하기-개발자가-아닌경우">✏️ 아티클 작성하기 (개발자가 아닌경우)</h2>

1. 해당 블로그에는 사용자가 에디터를 통해 직접 글을 등록할 수 있는 시스템이 구현되어 있지 않기 때문에, 작성한 글을 관리자에게 전달하여 관리자가 직접 등록하는 식으로 진행해야 합니다.

2. 글 작성도구 (Notion, 한컴오피스, MS Word 등) 를 통해 글을 작성하세요.

3. 작성한 파일을 `.md`, `.pdf`, `.hwp`, `.docx` 확장자 중 하나를 선택하여 관리자에게 전달하세요. (`.md파일`이 파일 생성 후 내용을 붙이기만 하면 되서 가장 편합니다.)

4. 파일을 받은 관리자는 파일 내용을 복사하여 `.mdx` 형식에 맞게 편집 후 글을 업로드합니다. (타이틀 구분을 따로할 수 없는 `.txt` 같은 파일은 사용하지 마세요.)

---

<h2 id="Netlify-배포-트리거가-필요한-경우">🌟 Netlify 배포 트리거가 필요한 경우</h2>

이미지 등 자산만 변경되어 블로그 본문 저장소(`if-tech-blog`)에 커밋이 없는 경우, 자동 배포가 트리거되지 않을 수 있습니다.

이때는 아래 방법 중 하나로 **Netlify 배포를 수동 트리거**합니다.

- Netlify UI에서 **Deploy site** 실행
- Netlify Build Hook을 만든 뒤 사이트 환경변수 `NETLIFY_BUILD_HOOK_URL`에 등록
- 또는 `if-tech-blog` 저장소에 배포 트리거용 빈 커밋 생성
  ```bash
  git commit --allow-empty -m "chore: trigger netlify deploy"
  git push
  ```

---

<h2 id="if-tech-blog-/-if-tech-blog-assets-저장소-관계">🗃️ if-tech-blog / if-tech-blog-assets 저장소 관계</h2>

두 저장소는 역할이 분리되어 있습니다.

- **if-tech-blog**
  - 블로그 소스코드, 글 본문, 메타데이터 관리
  - Netlify 배포의 기준이 되는 메인 저장소

- **if-tech-blog-assets**
  - 이미지 등 정적 자산 전용 저장소
  - 포스트 작성 중 생성된 이미지 파일을 별도로 관리

즉, **콘텐츠(글)와 자산(이미지)을 분리 관리**하여 운영 효율과 저장소 관리성을 높이는 구조입니다.

---

<h2 id="License">🌠 License</h2>

Copyright (c) 2026 ifcommunity
All rights reserved.

Permission is granted to any person to view, clone, and fork this repository,
and to modify the code for private, non-public use.

Redistribution Prohibited:

- You may not publish, distribute, sublicense, sell, or otherwise make available
  the Software (original or modified), in whole or in part, to any third party.
- You may not upload the Software (original or modified) to any public repository,
  package registry, app store, marketplace, or similar distribution channel.
- You may not represent the Software (original or modified) as your own work.

No Contributions:

- Pull requests, patches, or other contributions are not accepted.
  Any submitted contribution is unsolicited and may be closed without review.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

---

<a href="#목차">⬆️ 목차로 올라가기</a>
