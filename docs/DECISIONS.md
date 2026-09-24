# 기반 설계 결정 — Phase 0

2026-09-22. 기존 통합 스펙을 기준으로 구현했으며, 아래 항목이 오래된 예시보다 우선한다.

**사용자 확정 변경:** Firebase 연결은 `barum-10aad` 단일 프로젝트로 변경했다. 아래 초기 staging/prod 분리 결정은 이 지시로 대체한다. `.env.local`에 공개 SDK 설정과 서버 전용 base64 서비스 계정을 저장하며, local 환경 여부와 별도로 emulator 플래그로 실제/로컬 연결을 선택한다. 클라이언트·서버 프로젝트 일치 검증은 유지한다. 이전 프로젝트는 삭제하지 않았고 Vercel은 조작하지 않았다.

1. **문서 경로**: 실제 파일은 1~7번 통합 문서다. `00-INDEX.md`를 복구하고 AGENTS.md의 로드맵 참조를 수정했다. 구버전 브리핑은 사용하지 않는다.
2. **버전**: Next.js 15.5.25 / React 19 / Tailwind 3 / next-intl 4 / Node 22. 기존 Tailwind config 기반 명세를 유지한다. 정확한 패치 버전은 `package-lock.json`으로 고정한다.
3. **의존성 패치**: Firebase Admin 14.4 이상을 사용한다. Next.js 내부 PostCSS는 패치된 8.5.23 이상으로 override했다. gaxios는 uuid의 v4 API만 사용함을 확인하고 CJS를 지원하는 패치된 uuid 11.1.1 이상으로 한정 override했다. 운영 의존성 audit와 빌드를 재검증한다. 개발 도구의 잔여 advisory는 HANDOFF에 기록한다.
4. **환경 검증**: Firebase는 사용자 지정 `barum-10aad`를 사용하고 에뮬레이터는 `demo-barum`만 허용한다. Vercel에서는 `VERCEL_ENV`를 우선하며 development는 local로 대응한다. `APP_ENV`는 플랫폼 값이 없을 때만 사용한다. 누락·불일치한 APP_ENV로 빌드가 중단되는 문제를 수정했고 검수 갤러리도 같은 환경 판정을 사용한다. 배포 환경의 emulator=true, 비 HTTPS 사이트 URL, Firebase 클라이언트·서버 프로젝트 불일치는 계속 차단한다. 아직 사용하지 않는 기상청·해양·Admin 비밀키는 Phase 0에서 요구하지 않는다. 해당 기능을 활성화할 때 서버에서 필수 검증한다.
5. **테마**: 기본 설정은 system, 저장 키는 `barum.theme`. head의 동기 스크립트로 첫 페인트 전에 결정하고 OS 변경·다른 탭 변경을 구독한다. 글자 대비를 위해 text-tertiary 및 다크의 text-on-accent 값을 조정했다. 작은 강조 숫자에는 양쪽 테마에서 대비를 확보한 accent 토큰을 사용한다.
6. **토큰**: 색 리터럴은 CSS 토큰 선언에서만 허용한다. 기상 컬러맵도 CSS 토큰을 참조하는 값/토큰 배열이며 지점 데이터와 무관하다. 기본 색·표면·타이포·간격·라운드·그림자·모션은 Phase 0에서 준비한다.
7. **글꼴**: Pretendard Variable 및 Noto Sans SC/TC/JP의 unicode-range subset을 자체 호스팅한다. 현재 locale의 CSS만 링크하고 무조건적인 폰트 preload를 하지 않는다. 생성 파일은 `public/fonts`에 놓고 패키지로부터 빌드 시 재생성한다. SIL OFL 라이선스를 함께 복사한다.
8. **라우팅**: 한국어는 접두사 없이, 나머지는 /en·/zh-CN·/zh-TW·/ja를 사용한다. URL → next-intl 쿠키 → 브라우저 언어 → ko 순으로 감지한다. 로그인 사용자 설정은 Phase 6에서 쿠키/설정 동기화로 연결한다. Phase 0의 `/dev/gallery`는 Preview에서 검수 가능하며 production에서는 404로 닫힌다.
9. **Firebase 경계**: Firebase client/Admin은 지연 초기화한다. 현재 화면은 SDK를 로드하지 않는다. Cloud 프로젝트와 웹앱만 생성하며 요금제는 올리지 않는다. 기능별 데이터베이스·Storage·Auth 제공자·배치는 해당 Phase에서 활성화한다. 로컬 Firestore/Storage는 기본 차단 규칙으로 테스트한다. `request.app`을 Firestore Rules에 넣는 오래된 예시는 사용하지 않는다. App Check는 서비스별 enforcement와 서버 토큰 검증으로 추후 설계한다.
10. **Phase 1 계약**: 목업은 어댑터 내부에서만 반환한다. UI는 `Normalized*`와 API 응답 계약만 사용한다. 여러 기관 데이터가 섞이는 종합 응답에는 항목/도메인별 SourceMeta가 필요하다. 결측·오래됨·예측/실측·오류 상태를 구별한 뒤 목업 UI를 만든다. 아직 Phase 0에서는 기상 데이터를 반환하지 않는다.
11. **해석 엔진**: Phase 1에서 번역 키·파라미터를 갖는 결과 계약을 먼저 정의하고, Phase 2~3에서 실제 규칙을 연결한다. 안전 판단과 점수는 LLM에 맡기지 않는다. 현재 문서에 나타난 5종/6종 활동 범위는 Phase 1 계약 시 명시한다.
12. **검증 범위**: Phase 0의 E2E와 접근성은 현재 존재하는 기반 홈·갤러리 대상이다. 주요 제품 5화면 검증은 Phase 1에서 확장한다. 브라우저 자동 언어 감지를 검증하면서 한국어 케이스는 ko-KR 환경으로 실행한다. 테스트 서버는 개발 서버와 구분한 3100 포트를 쓴다.
13. **로컬 서버 호스트**: `localhost`로 바인딩한다. Next.js 15의 NextURL은 loopback IP를 localhost로 정규화하므로, 127.0.0.1로 바인딩하면 prefix-less locale의 내부 rewrite가 다른 origin으로 취급되어 리디렉션 루프를 일으켰다. 호스트 일치 후 `/`와 `/dev/gallery`의 200 응답을 확인했다.

## 후속 결정

- 지도 베이스 타일 공급자·사용 조건·키 제한: Phase 1 지도 구현 전에 결정. 유료 API 신규 도입은 사용자 확인 대상.
- 지도 기상 레이어의 PoC·GRIB 파이프라인: Phase 5. Phase 1 파티클을 실데이터처럼 표시하지 않는다.
- CCTV 스트림 사용 허가 및 실제 공급 경로: Phase 4.
- Firebase Functions/Cloud Run/Storage가 요금제 상향을 요구하면 해당 시점에 사용자 확인. 지금 결제나 요금제 변경은 하지 않았다.
- 배포 도메인이 확정되면 NEXT_PUBLIC_SITE_URL을 최종 canonical 도메인으로 변경한다.

## Phase 1 결정 — UI 골격

2026-09-23. Sol 구현.

1. **지도 베이스**: MapLibre GL JS 6.10.0과 무료·키 불필요 OpenFreeMap 기본 스타일을 사용한다. OpenFreeMap 및 OpenStreetMap 저작권 표기를 지도에 항상 노출한다. Windy에서는 지도 중심 정보 구조와 조작 패턴만 참고하고 코드·타일·아이콘·색상·로고는 사용하지 않는다.
2. **MapLibre 워커**: Next.js에서 `maplibre-gl-worker.mjs`와 상대 import 대상인 `maplibre-gl-shared.mjs`를 빌드 전에 `public/maplibre/`로 복사한다. 생성물은 Git에서 제외한다. 5.x의 운영 취약점을 피하기 위해 6.10.0으로 올렸고 운영 의존성 audit 0건을 확인했다.
3. **데이터 경계**: `src/types/domain.ts`의 `NormalizedPoint`, `NormalizedMarine`, `NormalizedTide`, `SourceMeta`, `AdviceResult`, 오류·부분 결측 계약을 UI의 유일한 입력으로 쓴다. 고정 목업은 `src/lib/sources/mock.ts` 안에만 둔다. 날씨·해양·물때 출처와 기준 시각은 각각 유지한다.
4. **표현 범위**: 지도 위 바람 선과 모든 수치는 Phase 1 UI 목업으로 명시한다. 실제 격자/파티클은 Phase 5 전까지 만들지 않으며 지점 API 반복 호출로 대체하지 않는다. CCTV 영상과 여행 이미지는 지금 단계에서 CSS 장면 목업이다.
5. **반응형**: 모바일은 드래그 가능한 28/55/92% 바텀시트, 태블릿은 우측 플로팅 패널, 데스크톱은 좌측 고정 상세 패널을 사용한다. 모든 형태에서 지도 포인터 이벤트를 유지한다.
6. **안전·출처**: 고립 위험 안내에는 면책 문구와 해양경찰 `tel:122` 동선을 함께 제공한다. 목업 카드에도 출처·기준 시각·신뢰도·목업 상태를 노출한다.
7. **검증 증거**: 주요 5화면의 다크·라이트 데스크톱 이미지 10장은 `docs/evidence/phase-1/`에 보관한다. 동일 화면을 모바일에서도 axe로 검사하며, 지도 로딩 완료 뒤 캡처한다.
