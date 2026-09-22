# Phase 0 인수인계

담당: Astra. 2026-09-22.

**후속 Firebase 변경:** 사용자 제공 SDK 설정과 루트 서비스 계정으로 `barum-10aad`에 통일했다. `.env.local` 생성 완료, emulator=false. `.firebaserc` 기본 프로젝트도 변경했다. 과거 staging/prod 및 서비스 계정 미사용 기록은 초기 작업 이력이다. 현재 키는 서버용 base64 환경변수에만 반영하고 Git에 포함하지 않는다. 오래된 Vercel 설정 스크립트는 제거했으며 Vercel 자체는 조작하지 않았다. 에뮬레이터 테스트 명령은 명시적으로 `demo-barum`을 유지한다.

**상태: 로컬 구현·검증 완료. GitHub 원격은 `jejuailabs/barum`, 기본 브랜치는 `main`. Vercel 자동 연결과 배포는 사용자가 직접 관리한다. Preview 완료 증거는 아직 없다.**

## DoD

- [x] `/`, `/en`, `/zh-CN`, `/zh-TW`, `/ja` 렌더링. 각 locale의 갤러리도 확인.
- [x] 다크·라이트·system 전환, 새로고침 후 유지, JS 청크 차단 상태에서도 초기 테마 적용 확인.
- [x] `typecheck`, `lint`, `test`, `i18n:check` 통과.
- [x] `/dev/gallery`에서 양쪽 테마의 색상·타이포 확인. 모바일·데스크톱 스크린샷 검수.
- [ ] Vercel Preview 배포 성공 — 자동 승인 검토가 파일 외부 전송에 대한 명시적 승인을 요구해 거절. 사용자 승인 후 재개.

## 검증 결과

| 검사 | 결과 |
|---|---|
| 타입 검사 / ESLint / 경계 검사 | 통과 |
| 단위 테스트 | 15개 통과 (환경 9, 초기 테마 6) |
| 번역 | 5개 언어 × 43개 키, 누락·초과·미사용·ICU 매개변수 검사 통과 |
| Firebase Emulator 규칙 | 4개 통과 (Firestore 비로그인·본인·타인 차단, Storage 업로드 차단) |
| 프로덕션 빌드 | Next.js 15.5.25 성공, locale 홈·갤러리 정적 생성 |
| 브라우저 E2E | 18개 통과 (Chromium 데스크톱·Pixel 7 에뮬레이션) |
| 접근성 | 4개 테스트 통과, 홈·갤러리 × 2테마 × 2뷰포트 8개 화면 axe 위반 0 |
| 초기 JS 예산 | 홈·갤러리 각각 118.7KiB gzip / 180KiB |
| 운영 의존성 audit | 0 vulnerabilities |

전체 개발 의존성에는 Firebase CLI·Vitest 계열의 moderate advisory 7개가 남아 있다. 개발 서버는 localhost에만 바인딩하며 운영 번들에는 포함되지 않는다. 후속 도구 업데이트 시 재검토한다. iOS Safari/실기기 검증과 주요 제품 5화면 검증은 Phase 1 이후 범위다.

스크린샷 8장은 `docs/evidence/phase-0/`에 보관했다. 파일명은 `{home|gallery}-{dark|light}-{desktop|mobile}.png`다. 다음 테스트가 `test-results/`를 초기화해도 증거가 유지된다.

## 만들어진 기반

- Next.js App Router / TS strict / Tailwind 3 / next-intl 4 / Node 22.
- `src/app/globals.css`: 두 테마 및 기상 컬러맵 토큰. `tailwind.config.ts`: 시맨틱 유틸·타이포.
- `src/i18n/*`, `messages/*`: locale 라우팅·문자열. `/dev/gallery`는 production에서 404.
- `src/env.ts`: 배포 환경 혼용·공개 비밀키·누락 설정 차단.
- `src/lib/firebase/*`: 지연 초기화된 client/Admin 경계. 기본 차단 Firestore/Storage 규칙.
- `scripts/*`: 번역·문자열/색상/서버 경계·번들 검사, 자체 호스팅 subset 글꼴, 에뮬레이터 실행.
- `.github/workflows/ci.yml`: 품질 검사 파이프라인 정의. 원격 GitHub 저장소는 아직 연결하지 않았다.
- 문서 경로 복구: `00-INDEX.md`. 구현 판단: `DECISIONS.md`.

## 외부 환경 및 보류 항목

- Firebase 프로젝트 `barum-staging` (1047981786467), `barum-prod` (238520446288) 생성.
- 각 프로젝트에 웹앱 생성, Vercel의 preview/production에 구분된 공개 SDK 설정 등록.
- Vercel `funjejus-projects/barum` 연결 완료. `.vercel/project.json`은 로컬 파일이며 Git 제외.
- 과금/요금제 변경 없음. Cloud Firestore DB·Storage 버킷·Auth 제공자·Functions/Run은 기능 도입 시 활성화한다. 로컬 Emulator는 `demo-barum`만 사용.
- 로컬에 사용자가 추가한 `barum-10aad` 서비스 계정 JSON, `firebase_sdk.txt`, `새 텍스트 문서.txt`는 읽거나 수정하지 않았다. Git 및 Vercel 제외 규칙을 추가했다. 해당 Firebase 프로젝트로 변경할 의도인지는 비동기 질문을 남겼다. 답변 전에는 기존 staging/prod 분리를 유지한다.
- 서비스 계정·기상청·KHOA 비밀키는 어떤 배포에도 등록하지 않았다. 아직 사용하는 기능이 없다.

## 남은 Phase 0 배포 확인 — 사용자 관리

사용자가 Vercel은 직접 GitHub에 자동 연결하겠다고 지시했다. 아래의 이전 배포 승인·CLI 실행 절차는 더 이상 실행하지 않는다. 별도 요청이 있기 전에는 Vercel 조작이나 배포 승인을 요청하지 않는다. 사용자가 배포 결과를 제공하면 마지막 DoD 증거를 기록한다.

### 이전 절차 (실행하지 않음)

1. 사용자에게 **프로젝트 코드와 생성된 공개 글꼴 파일을 Vercel `funjejus-projects/barum` Preview로 전송**하는 승인을 받는다. 기존 자동 검토 거절을 우회하지 않는다.
2. `git check-ignore`로 서비스 계정 JSON·사용자 TXT·`.env.local`을 확인한다. `.vercelignore`의 키 파일 제외도 유지한다.
3. `vercel deploy --yes --scope funjejus-projects` 실행. production 배포는 하지 않는다.
4. 빌드 성공·Ready 상태와 Preview URL을 기록하고 5개 locale 및 갤러리 응답을 확인한다. Preview 보호 설정이 있으면 해제하지 않는다.
5. 이 문서의 마지막 DoD를 체크하고 사용자 요청대로 Sol에 Phase 1을 넘긴다.

## Sol 시작 지점

Phase 0 DoD 전부 통과한 후 `RUN-P1.md`를 실행한다. 기존 기반을 재작성하지 않는다. 원래 디자인 시안은 `images/`의 4개 PNG이며, Phase 0 갤러리를 실제 제품 디자인으로 오해하지 않는다.

로컬 명령과 환경 설치 방법은 README를 따른다. Java 21은 현재 `.tools/java21`에만 준비되어 있다. Git 기본 브랜치는 `main`, 원격은 `https://github.com/jejuailabs/barum.git`이다. Phase 0 코드·문서·시안은 첫 커밋에 포함하고 서비스 계정 및 로컬 설정은 제외한다. 사용자가 추가한 파일은 커밋 전에 비밀정보 포함 여부를 확인한다.
