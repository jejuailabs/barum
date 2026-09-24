# 바름닷컴

제주 중심 해양·기상 플랫폼. Phase 1~5 UI, 지점 날씨, 물때, CCTV 기반 구조, WebGL 격자 레이어까지 구현되어 있다.

먼저 [AGENTS.md](AGENTS.md), [문서 인덱스](docs/00-INDEX.md), [Phase 5 인수인계](docs/HANDOFF-P5.md)를 읽는다. 환경값 종류는 [환경 변수 안내](docs/ENVIRONMENT.md)에 정리되어 있다.

## 로컬 실행

Node 22가 필요하다. `npm ci` 후 `npm run dev`를 실행한다. predev/prebuild가 로컬 글꼴과 MapLibre 워커 파일을 `public/`에 준비한다. 현재 `.env.local`은 사용자가 지정한 `barum-10aad` 프로젝트에 연결되어 있다. Firebase 값과 서비스 계정은 반영 완료됐고, 사용자가 추가할 값은 `KMA_SERVICE_KEY`와 `KHOA_SERVICE_KEY` 두 개다. 둘 다 비어 있어도 폴백 소스로 실행된다. `.env.local`과 원본 서비스 계정은 Git 제외 대상이다.

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

`NEXT_PUBLIC_SITE_URL`이 비어 있거나 localhost이면 Vercel의 HTTPS 배포 주소를 사용한다. production은 `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL`, preview는 `VERCEL_URL` 순으로 결정한다. 명시한 HTTPS 도메인은 유지한다.

Vercel에서는 `VERCEL_ENV`로 실행 환경을 자동 결정한다. `APP_ENV`는 Vercel 밖에서만 사용하므로 별도로 맞출 필요가 없다. 배포 시 HTTPS 사이트 URL, 에뮬레이터 비활성화, Firebase 프로젝트 일치 검증은 유지한다.

Firebase는 사용자가 지정한 `barum-10aad`를 사용한다. `FIREBASE_PROJECT_ID`와 클라이언트 프로젝트 ID가 일치해야 하며, 로컬에서도 emulator=false이면 서버 Admin은 실제 서비스 계정을 사용한다. measurementId는 연결 설정에 반영되어 있지만 Analytics 자동 수집은 아직 초기화하지 않는다. `vercel.json`은 글꼴 준비를 포함한 `npm run build`를 실행한다.

GitHub 저장소는 [jejuailabs/barum](https://github.com/jejuailabs/barum), 기본 브랜치는 `main`이다. GitHub Actions 정의는 `.github/workflows/ci.yml`에 있다. push/PR가 생기면 타입·lint·번역·테스트·보안규칙·빌드·번들·브라우저·접근성 검사를 실행한다.

Vercel의 GitHub 자동 연결과 배포는 사용자가 관리한다. 에이전트는 별도 요청 없이 Vercel 프로젝트·환경변수·배포를 조작하지 않는다.

현재 홈은 MapLibre 기반 지도 중심 UI다. 지점 날씨는 실시간 Open-Meteo 폴백이 연결되어 있고, KMA 키를 넣으면 공식 초단기 자료를 우선한다. 물때는 KHOA 키가 없을 때 참고 모델로 표시된다. CCTV는 재배포 권한 확인 전 제공기관 링크 모드다. 기상 지도는 로컬에 내려받은 NOAA GFS 0.25° 바람·강수·기온·파도 17×15 격자를 +120시간까지 표시하며, 수집 파일이 없을 때만 출처가 명시된 `BARUM_POC` 필드로 폴백한다. `/dev/gallery`는 계속 유지한다.
