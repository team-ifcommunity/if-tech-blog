# 썸네일 업로드 테스트

## 배포 전 확인

Netlify에 다음 환경변수가 설정되어 있어야 합니다.

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (선택, 기본값 `main`)

로컬에서 Function까지 함께 확인하려면 프로젝트 루트에서 `netlify dev`를 실행하고, 표시된 주소의 `/admin/write`로 접속합니다. `npm run dev`만 실행하면 Netlify Function 주소가 404로 응답합니다.

## 정상 동작

1. `/admin/write`에서 제목, 요약, 카테고리, 작성자, URL 이름을 입력합니다.
2. 3MB 이하의 PNG, JPG, JPEG 또는 WEBP 이미지를 선택합니다.
3. 미리보기가 표시되는지 확인하고 본문을 입력한 뒤 **글 게시하기**를 누릅니다.
4. GitHub에서 아래 두 파일이 생성됐는지 확인합니다.
   - `public/post/{year}/{category}/{MM-DD}/{slug}/assets/images/thumbnail.{ext}`
   - `src/content/blog/{제목}.mdx`
5. 생성된 MDX의 `heroImage`가 첫 번째 파일의 공개 경로인 `/post/{year}/{category}/{MM-DD}/{slug}/assets/images/thumbnail.{ext}`와 같은지 확인합니다.
6. Netlify 배포 완료 후 목록과 상세 화면에서 썸네일이 표시되는지 확인합니다.

## 오류 확인

- 3MB를 넘는 이미지: `썸네일 이미지 크기는 3MB 이하여야 합니다.`
- GIF, SVG 등 허용되지 않은 파일: 허용 형식 안내 메시지
- 확장자만 바꾼 파일: 서버에서 파일 내용과 이미지 형식 불일치 메시지
- 썸네일 미선택: 브라우저 필수 입력 안내 또는 썸네일 선택 메시지

이미지가 업로드된 뒤 게시글 생성만 실패한 경우 같은 입력으로 다시 게시할 수 있습니다. 같은 경로의 기존 이미지는 덮어쓰지 않고 재사용합니다.
