# 바름닷컴

제주 중심 해양·기상 플랫폼. 현재 Phase 0 기반 구현.

먼저 [AGENTS.md](AGENTS.md), [문서 인덱스](docs/00-INDEX.md), [Phase 0 인수인계](docs/HANDOFF-P0.md)를 읽는다.

## 로컬 실행

Node 22가 필요하다. `npm ci` 후 `npm run dev`를 실행한다. 현재 `.env.local`은 사용자가 지정한 `barum-10aad` 프로젝트에 연결한다. 새 환경에서는 `.env.example`을 복사하고 공개 API 키와 서버용 서비스 계정(base64)을 채운다. `.env.local`과 원본 서비스 계정은 Git 제외 대상이다. 환경 파일 없이 실행하면 에뮬레이터용 UI 기본값을 사용한다.

- 홈: http://localhost:3000
- 토큰 갤러리: http://localhost:3000/dev/gallery
- 언어: `/`, `/en`, `/zh-CN`, `/zh-TW`, `/ja`
- 첫 방문은 브라우저 언어를 감지한다. 한국어를 고르면 접두사 없는 경로를 사용한다.

## 검증

```sh
npm run typecheck
npm run lint
npm run test
npm run i18n:check
npm run build
npm run analyze
npm run test:e2e
npm run a11y
npm run test:rules
```

브라우저 최초 준비: `npx playwright install chromium`. E2E는 빌드된 앱을 3100 포트에서 실행한다. 테스트의 최초 스크린샷은 `test-results/`, 보고서는 `playwright-report/`에 생성된다. `E2E_BASE_URL`을 주면 이미 실행 중인 서버를 사용한다.

에뮬레이터는 Java 21 이상이 필요하다. `npm run emulators`로 Auth(9099), Firestore(8080), Storage(9199), UI(4000)를 실행한다. 프로젝트 ID는 항상 `demo-barum`이다. Windows 로컬에서 `.tools/java21/*/bin/java.exe`가 있으면 해당 프로세스에만 사용하며 시스템 설정은 변경하지 않는다. CI에서는 setup-java로 준비한다.

## 배포와 환경

Vercel에서는 `VERCEL_ENV`로 실행 환경을 자동 결정한다. `APP_ENV`는 Vercel 밖에서만 사용하므로 별도로 맞출 필요가 없다. 배포 시 HTTPS 사이트 URL, 에뮬레이터 비활성화, Firebase 프로젝트 일치 검증은 유지한다.

Firebase는 사용자가 지정한 `barum-10aad`를 사용한다. `FIREBASE_PROJECT_ID`와 클라이언트 프로젝트 ID가 일치해야 하며, 로컬에서도 emulator=false이면 서버 Admin은 실제 서비스 계정을 사용한다. measurementId는 연결 설정에 반영되어 있지만 Analytics 자동 수집은 아직 초기화하지 않는다. `vercel.json`은 글꼴 준비를 포함한 `npm run build`를 실행한다.

GitHub 저장소는 [jejuailabs/barum](https://github.com/jejuailabs/barum), 기본 브랜치는 `main`이다. GitHub Actions 정의는 `.github/workflows/ci.yml`에 있다. push/PR가 생기면 타입·lint·번역·테스트·보안규칙·빌드·번들·브라우저·접근성 검사를 실행한다.

Vercel의 GitHub 자동 연결과 배포는 사용자가 관리한다. 에이전트는 별도 요청 없이 Vercel 프로젝트·환경변수·배포를 조작하지 않는다.

현재 홈은 Phase 0 검수 화면이다. 지도·바텀시트·하단 5탭·실제 기상 데이터는 다음 Phase에서 구현한다. `/dev/gallery`는 계속 유지한다.
