# AGENTS.md — 바름닷컴

> **이 파일과 [`docs/00-INDEX.md`](docs/00-INDEX.md) 만 항상 읽는다. 나머지는 지금 하는 작업에 필요한 것만 읽는다.**
> 스펙 전체를 통으로 읽지 마라. 그러라고 파일을 쪼개놨다.

## 30초 요약

- **무엇**: 제주 중심 실시간 해양·기상 플랫폼. Windy형 지도 UX + 기상청 초단기 + 국립해양조사원 물때 + 실시간 CCTV.
- **차별점**: 숫자를 보여주는 게 아니라 **"오늘 서핑 보통, 오후에 파도 살아나요"라고 판단해주는 해석 엔진**.
- **스택**: Next.js 15 (App Router) / TypeScript / Tailwind / MapLibre GL JS / Firebase / Vercel
- **필수 요건**: 다국어 5개(ko·en·zh-CN·zh-TW·ja), 다크+라이트 모드, 마이페이지, 어드민 콘솔

## 문서 읽는 법

1. 지금 할 작업을 정한다 (보통 현재 Phase).
2. [`docs/00-INDEX.md`](docs/00-INDEX.md) 의 **Phase → 읽을 파일** 표에서 해당 파일만 읽는다.
3. 작업 중 다른 영역이 필요해지면 그때 그 파일만 추가로 읽는다.

`bareum_com_implementation_brief.md` 는 구버전(v1)이며 **읽지 않는다.** 상충하면 `docs/` 가 이긴다.

---

## 절대 규칙 (위반 시 재작업)

| # | 규칙 |
|---|---|
| R1 | **Windy의 코드·타일·아이콘·색상 팔레트·로고를 복제하지 않는다.** 참고하는 것은 "지도 중심 UX 패턴"뿐이다. |
| R2 | **지점(Point) 데이터와 격자(Grid) 데이터를 절대 섞지 않는다.** 지도 전면 레이어를 지점 API 반복 호출로 구현 금지. |
| R3 | **외부 API 응답 타입을 UI 컴포넌트가 직접 import 하지 않는다.** 반드시 `Normalized*` 내부 타입을 거친다. |
| R4 | **비밀키는 `NEXT_PUBLIC_` 접두사에 넣지 않는다.** KMA/KHOA/Firebase Admin 키는 서버 라우트 전용. |
| R5 | **하드코딩된 한국어 문자열 금지.** 모든 노출 문자열은 `messages/{locale}.json` 키를 통한다. |
| R6 | **하드코딩된 색상값 금지.** (`#0B1A2A`, `bg-blue-500` 등) 시맨틱 CSS 변수 토큰만 사용한다. 라이트 모드가 깨진다. |
| R7 | **모든 데이터 표시에 출처와 기준 시각이 따라붙는다.** |
| R8 | Phase 종료 시 **DoD 체크리스트를 결과와 함께 출력**하고, 미충족 항목을 먼저 처리한다. |
| R9 | 목업 단계에서도 **타입과 API 계약은 실제와 동일하게** 만든다. mock은 어댑터 안쪽에서만. |
| R10 | 안전 기능(물때 고립 경고 등)은 **면책 문구 + 해양경찰 122 동선**을 항상 동반한다. |
| R11 | 지도 상호작용(팬/줌)을 막는 모달 금지. 상세는 전부 **드래그 가능한 바텀시트**. |
| R12 | 모든 신규 컴포넌트는 **다크·라이트 두 모드를 확인한 뒤** 완료 처리한다. |

## 자율 판단 vs 확인 필요

- **자율 판단 OK**: 파일 분할 방식, 내부 유틸 시그니처, 테스트 케이스 선정, 애니메이션 이징 세부값, Tailwind 유틸 조합, 로딩 스켈레톤 형태.
- **멈추고 확인**: 외부 유료 API 신규 도입, Firebase 요금제 상향이 필요한 설계, **GPL 라이선스 라이브러리 채택**, 개인정보 신규 수집 항목 추가, Firestore 스키마 파괴적 변경, 하단 5탭 구조 변경.

## 용어 통일 (코드·문서 공통)

| 용어 | 코드 식별자 | 뜻 |
|---|---|---|
| 지점 | `Spot` | 사용자가 보는 장소 단위 (애월, 협재해변) |
| 관측소 | `Station` | KHOA 조위관측소 / KMA 관측지점 |
| 격자 | `Grid` | 지도 전면 렌더링용 수치모델 격자 데이터 |
| 물때 | `Tide` | 조석·조위·물때 번호 전체 |
| 해석 | `Advice` | 수치를 활동별 문장으로 번역한 결과 |
| 제보 | `Report` | 사용자가 올린 현장 상황 |
| 기록 | `LogEntry` | 로그북 한 건 |

---

## 진행 방식

### 저장소·배포 운영 지침 (사용자 지정)

- GitHub 원격은 `https://github.com/jejuailabs/barum.git`, 기본 브랜치는 `main`을 사용한다.
- Vercel의 GitHub 자동 연결과 배포 관리는 사용자가 직접 한다. 별도 요청 전에는 Vercel 프로젝트·환경변수·배포를 조작하거나 배포 승인을 요청하지 않는다.

**Phase 0 → 8 순차 진행.** 각 Phase의 DoD를 통과하기 전에 다음으로 넘어가지 않는다.
Phase 목록과 DoD는 [`docs/7-roadmap.md`](docs/7-roadmap.md) 에 있다. **해당 Phase 절만 읽으면 된다.**

## 명령어

```bash
npm run dev            # 개발 서버
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # 하드코딩 문자열/색상 규칙 포함
npm run test           # vitest 유닛
npm run test:e2e       # playwright
npm run a11y           # axe-core (주요 5화면 × 2테마)
npm run i18n:check     # 로케일 키 정합성
npm run analyze        # 번들 예산 검사
npm run emulators      # Firebase Emulator Suite
```

## 디렉터리 지도

```
src/app/[locale]/   사용자 화면 (지도·지점·물때·CCTV·여행·마이페이지)
src/app/admin/      어드민 콘솔
src/app/api/v1/     BFF API
src/lib/sources/    외부 API 어댑터 (KMA / KHOA / Open-Meteo / GFS / ECMWF)
src/lib/advice/     해석 엔진 — 이 제품의 핵심
src/lib/tide/       물때 계산 · 안전 로직
src/components/     UI (docs/2-design.md §5.4 카탈로그와 1:1)
messages/           i18n 번역 파일 5개
workers/            GRIB 인제스트 · CCTV 썸네일 (Cloud Run Job)
functions/          Firebase Functions (헬스체크 · 알림 엔진 · 조석 배치)
```

## 자주 틀리는 지점

| 함정 | 올바른 방법 |
|---|---|
| 지도 전면 레이어를 지점 API 반복 호출로 구현 | GRIB2 격자 → 타일/텍스처 파이프라인 |
| Firebase Admin SDK를 Edge 런타임에서 사용 | Node.js 런타임 라우트에서만 |
| middleware에서 세션 쿠키 전체 검증 | middleware는 존재 확인만, 검증은 라우트에서 |
| KHOA API를 요청마다 호출 | 일 20,000건 제한 — 매일 새벽 일괄 선계산 후 캐시 서빙 |
| 조위를 인접 지점으로 선형 보간 | 조석은 보간 금지. 최근접 관측소 값 + 관측소명 표기 |
| 클라이언트가 Firestore에서 기상 데이터 직접 읽기 | 기상은 항상 BFF API 경유 |
| 라이트 모드를 나중에 추가 | 토큰 설계 단계부터 두 모드 동시 정의 |
| **스펙 전체를 매번 읽기** | **Phase에 필요한 파일만 읽기 (docs/00-INDEX.md)** |
