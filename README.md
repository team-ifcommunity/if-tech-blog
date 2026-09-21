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

`NETLIFY_BUILD_HOOK_URL`이 설정되어 있으면 관리자 글 작성·수정 완료 직후 새 배포를 자동으로 요청합니다.

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

# CMS 로컬 저장과 수동 게시

로컬에서 CMS를 테스트할 때는 커밋되지 않는 로컬 `.env`에 다음 값을 직접 설정합니다.

```env
CMS_STORAGE_MODE=local
CMS_AUTH_MODE=dev
```

그 다음 의존성을 설치하고 Netlify Functions와 Astro를 함께 실행합니다.

```bash
npm install
npx netlify dev
```

`/admin/write`와 `/admin/edit`에는 로컬 모드에서 두 가지 저장 동작이 표시됩니다.

- **로컬 저장**: `src/content/blog/*.mdx`와 `public/post/{year}/{category}/{MM-DD}/{slug}/assets/images/`만 변경합니다. GitHub API와 Netlify 배포는 호출하지 않습니다. Astro가 파일 변경을 감지하므로 localhost에서 바로 확인할 수 있습니다.
- **GitHub에 게시/반영**: 현재 글이 참조하는 로컬 이미지를 `team-ifcommunity/if-tech-blog-assets`에 올리고, MDX를 `team-ifcommunity/if-tech-blog`에 반영합니다. 이때만 GitHub 커밋과 Netlify 배포가 시작됩니다.

로컬 파일 접근은 `CMS_STORAGE_MODE=local`이면서 Netlify CLI가 설정하는 `NETLIFY_DEV=true`인 경우에만 허용됩니다. 따라서 `astro dev`가 아니라 `netlify dev`를 사용해야 합니다.

Netlify 운영 환경에는 다음 값을 설정합니다.

```env
CMS_STORAGE_MODE=github
CMS_AUTH_MODE=synology
SYNOLOGY_OIDC_ISSUER=https://<synology-sso-host>
SYNOLOGY_OIDC_CLIENT_ID=<application-id>
SYNOLOGY_OIDC_CLIENT_SECRET=<application-secret>
SYNOLOGY_OIDC_REDIRECT_URI=https://ifcommunity-tech.netlify.app/auth/callback
CMS_SESSION_SECRET=<32자-이상의-무작위-비밀값>
```

Synology SSO Server 응용프로그램의 redirect URI에도 `https://ifcommunity-tech.netlify.app/auth/callback`을 정확히 등록합니다. 일반적인 Synology 설정은 issuer metadata로 endpoint를 자동 검색합니다. metadata를 제공하지 않는 구성이라면 `SYNOLOGY_OIDC_AUTHORIZATION_ENDPOINT`, `SYNOLOGY_OIDC_TOKEN_ENDPOINT`, `SYNOLOGY_OIDC_USERINFO_ENDPOINT`, `SYNOLOGY_OIDC_JWKS_URI`를 Netlify에 추가합니다. token endpoint가 HTTP Basic 인증만 받는 경우 `SYNOLOGY_OIDC_TOKEN_AUTH_METHOD=client_secret_basic`도 추가합니다.

운영 모드에서는 GitHub 게시/반영 버튼만 표시되고 기존 GitHub 저장 흐름을 사용합니다. `/admin` 접근 시 Synology 로그인으로 이동하며, 작성자에는 로그인 사용자 이름이 자동 적용됩니다. `CMS_AUTH_MODE=dev`는 `netlify dev`이면서 production이 아닌 경우에만 동작합니다. 테스트 순서는 새 글 또는 기존 글을 열어 **로컬 저장** → localhost 확인 → **GitHub에 게시/반영** → 두 저장소의 커밋과 Netlify 배포 확인입니다.

## CMS 게시글 삭제

`/admin/posts`의 각 게시글에는 수정과 삭제 작업이 표시됩니다. 삭제 버튼을 누른 뒤 확인 모달에서 삭제 범위와 대상을 다시 확인해야 실제 삭제가 실행됩니다.

- **로컬 삭제**: `CMS_STORAGE_MODE=local`이고 `netlify dev`로 실행한 경우에만 사용할 수 있습니다. 해당 `src/content/blog/*.mdx` 파일과 MDX의 `pubDate`, `category`, `slug`로 계산한 `public/post/{year}/{category}/{MM-DD}/{slug}/` 폴더를 삭제합니다. GitHub API와 Netlify 배포는 호출하지 않습니다.
- **GitHub에서 삭제**: `if-tech-blog` main 브랜치의 MDX를 SHA 기반 Contents API로 삭제하고, `if-tech-blog-assets`의 동일한 글 자산 폴더 아래 blob을 Git tree 커밋 하나로 제거합니다. GitHub 삭제가 실행된 경우에만 Netlify Build Hook을 호출합니다.
- 로컬 모드에서는 **로컬 삭제**와 **GitHub에서 삭제**가 별도 버튼으로 표시됩니다. 운영 모드에서는 GitHub 삭제만 표시됩니다.

삭제 함수는 브라우저가 전달한 자산 경로를 사용하지 않습니다. 삭제 직전에 실제 MDX를 읽고 frontmatter를 검증해 자산 경로를 계산하며, 게시글은 `src/content/blog/*.mdx`, 로컬 자산은 `public/post/`, 원격 자산은 해당 글 prefix 밖을 삭제할 수 없도록 제한합니다. 자산 폴더가 이미 없으면 MDX 삭제는 정상 완료됩니다.

로컬 테스트는 테스트 글을 만든 뒤 `/admin/posts`에서 **로컬 삭제**를 실행하고 MDX와 자산 폴더가 모두 사라졌는지 확인합니다. 운영 삭제 테스트는 별도의 테스트 글로 **GitHub에서 삭제**를 실행한 뒤 두 저장소의 삭제 커밋, 관리자 목록 갱신, Netlify 배포 상태를 확인합니다. 운영 삭제는 복구가 어려우므로 대상 글과 모달의 경고를 반드시 확인하세요.
