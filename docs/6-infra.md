> 바름닷컴 스펙 · 6 인프라·성능·구조·테스트·법적 · [← AGENTS.md](../AGENTS.md)


# 15. 인프라 — Firebase + Vercel 경계 설계

## 15.1 역할 분담 (가장 흔한 실수 지점이므로 엄격히 지킨다)

| 계층 | 담당 | 이유 |
|---|---|---|
| **렌더링 / BFF API** | **Vercel** (Next.js App Router, Route Handler) | 사용자 대면 지연 최소화, ISR·Edge 캐시 |
| **인증** | **Firebase Auth** (세션 쿠키는 Vercel에서 발급·검증) | 소셜 로그인 관리 부담 제거 |
| **데이터베이스** | **Firestore** | 실시간 구독, 오프라인 지속성, 보안 규칙 |
| **파일** | **Firebase Storage** (사용자 사진·CCTV 썸네일) | Auth 연동 |
| **푸시** | **FCM** | 웹푸시 표준 |
| **피처 플래그** | **Remote Config** | 배포 없는 튜닝 (§10.9) |
| **배치·스케줄러** | **Cloud Functions v2 / Cloud Run Jobs** | 장시간 작업(GRIB 인제스트, ffmpeg)은 Vercel 함수 타임아웃에 부적합 |
| **가벼운 크론** | Vercel Cron (예: 캐시 워밍) | — |
| **KV 캐시** | Upstash Redis | 초단기 데이터 TTL 캐시 |
| **정적 대용량 산출물** | Vercel Blob 또는 Cloudflare R2 | 기상 타일·격자 바이너리 |

**금지**: Firebase Hosting과 Vercel을 동시에 프론트 배포에 쓰지 않는다. 프론트는 **Vercel 단일**.
**금지**: 클라이언트가 Firestore에서 기상 데이터를 직접 읽지 않는다. 기상은 항상 BFF API 경유(캐시·출처 메타 일관성).

## 15.2 Firestore 컬렉션 스키마

```
users/{uid}
  profile: { displayName, photoURL, createdAt, locale, level }
  settings: { theme, locale, units:{temp,wind,height,distance,time}, mode:'basic'|'pro',
              colorSafe, startScreen, defaultLayer, mapStyle, dataSaver }
  activityProfile: { activities:[{key,skill,priority}], preferences:{wave,wind,windDir,seaTemp},
                     radiusKm, timeOfDay:[] }
  stats: { logCount, reportCount, acceptedReportCount }
  /favorites/{spotId}     { spotId, type, order, pinned, notify, offlineCache, createdAt }
  /alertRules/{ruleId}    { kind:'condition'|'tide'|'safety'|'warning'|'cctv',
                            spotId, conditions:{...}, schedule, quietHours, channels, enabled,
                            expiresAt, lastFiredAt, createdAt, updatedAt }
  /logbook/{entryId}      { at, spotId, activity, rating, memo, photos[],
                            snapshot:{ temp, wind, wave, tide, seaTemp, source, issuedAt },
                            extra:{...}, visibility:'private'|'public' }
  /notifications/{id}     { kind, title, body, deepLink, sentAt, readAt, feedback }
  /devices/{token}        { platform, locale, lastSeenAt }

spots/{spotId}            { name:{i18n}, lat, lng, type, tideSystem, activityTags[],
                            kmaGrid:{nx,ny}, khoaStation:{id,name,distanceKm},
                            buoyStation, heroImage, enabled, updatedBy, updatedAt }
cctv/{id}                 (§13.1)
places/{id}               { name:{i18n}, desc:{i18n}, lat, lng, category, indoor,
                            bestTimeOfDay[], activityTags[], conditions:{waveRange,windMax},
                            images[], published, order }
courses/{id}              { title:{i18n}, desc:{i18n}, placeIds[], durationMin, badges[], published }
notices/{id}              { title:{i18n}, body:{i18n}, startAt, endAt, locales[], screens[], priority }
reports/{id}              { uid, spotId, kind, text, photos[], lat, lng, createdAt,
                            status:'pending'|'approved'|'rejected', reviewedBy, reason }
tideCache/{stationId}_{date}   { series[], events[], mulddae, computedAt, ttl }
adviceCache/{spotId}_{hourKey}_{locale}  { result, createdAt, ttl }
sourceHealth/{sourceId}   { lastOkAt, successRate24h, avgMs, quotaUsed, quotaLimit, lastError }
adminAudit/{id}           { at, actorUid, actorEmail, action, target, before, after, ip }
featureFlags/{key}        (Remote Config 미러 — 서버 읽기용)
```

**인덱스**: `reports(status, createdAt)`, `cctv(enabled, status, sortOrder)`, `places(published, category)`, `users/{uid}/logbook(at desc)`, `users/{uid}/alertRules(enabled, kind)`.

## 15.3 Storage 구조
```
/users/{uid}/logbook/{entryId}/{fileId}.webp     최대 5MB, 업로드 시 클라이언트에서 WebP 변환·리사이즈(최대 1600px)
/cctv/thumbnails/{cctvId}.webp                   서버 전용 쓰기
/content/places/{placeId}/{fileId}.webp          어드민 전용 쓰기
/public/og/{route}.png                           OG 이미지 캐시
```

## 15.4 Firestore 보안 규칙 (핵심 원칙)

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isSignedIn() { return request.auth != null; }
    function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }
    function role() { return request.auth.token.role; }
    function isAdmin() { return role() in ['superadmin','operator','editor','moderator']; }

    // 사용자 개인 데이터: 본인만
    match /users/{uid} {
      allow read, write: if isOwner(uid);
      match /{sub=**} { allow read, write: if isOwner(uid); }
    }

    // 공개 마스터 데이터: 읽기는 모두, 쓰기는 서버(Admin SDK)만
    match /spots/{id}   { allow read: if true; allow write: if false; }
    match /cctv/{id}    { allow read: if resource.data.enabled == true; allow write: if false; }
    match /places/{id}  { allow read: if resource.data.published == true; allow write: if false; }
    match /courses/{id} { allow read: if resource.data.published == true; allow write: if false; }

    // 제보: 본인 생성, 승인된 것만 공개 읽기
    match /reports/{id} {
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
      allow read:   if resource.data.status == 'approved' || isOwner(resource.data.uid) || isAdmin();
      allow update, delete: if false;   // 수정은 서버 경유
    }

    // 캐시·헬스·감사 로그: 클라이언트 접근 전면 차단
    match /tideCache/{id}    { allow read, write: if false; }
    match /adviceCache/{id}  { allow read, write: if false; }
    match /sourceHealth/{id} { allow read, write: if false; }
    match /adminAudit/{id}   { allow read, write: if false; }
  }
}
```
**원칙**: 쓰기는 가능한 한 전부 서버(Admin SDK) 경유. 클라이언트 직접 쓰기는 `users/{uid}` 하위와 `reports` 생성뿐이다.
**App Check** 를 활성화해 규칙에 `request.app != null` 조건을 추가한다.

## 15.5 환경 변수

```env
# ---- Public (클라이언트 노출 OK) ----
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_MAP_STYLE_URL_DARK=
NEXT_PUBLIC_MAP_STYLE_URL_LIGHT=
NEXT_PUBLIC_MAPTILER_KEY=            # 또는 자체 타일 서버
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=      # App Check
NEXT_PUBLIC_TILE_BASE_URL=

# ---- Secret (서버 전용, R4) ----
FIREBASE_SERVICE_ACCOUNT_JSON=       # base64 인코딩
DATA_GO_KR_SERVICE_KEY=              # 기상청 / KHOA 공공데이터포털 키
KMA_APIHUB_KEY=                      # 기상청 API허브(별도)
KHOA_API_KEY=                        # 바다누리 직접 발급분
OPEN_METEO_API_KEY=                  # 선택
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=               # 또는 R2_*
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
RESEND_API_KEY=
SENTRY_DSN=
CRON_SECRET=                         # 크론 엔드포인트 보호
INGEST_WORKER_URL=
INGEST_WORKER_TOKEN=
```

**검증**: `src/env.ts` 에서 `zod` 로 런타임 검증한다. 누락 시 부팅 실패시킨다(조용한 오작동 방지).

## 15.6 환경 분리
```
local     : Firebase Emulator Suite (Auth/Firestore/Storage/Functions) + mock 어댑터
preview   : Vercel Preview + Firebase `barum-staging` 프로젝트 + 실 API(저빈도)
production: Vercel Production + Firebase `barum-prod`
```
Preview 배포는 **절대 prod Firestore를 가리키지 않는다.** 환경 배지를 어드민 상단에 항상 표시한다(§10.10).
---


# 16. 성능 · 품질 예산

## 16.1 성능 예산 (측정 기준: 중급 안드로이드 + 4G, Lighthouse mobile)

| 항목 | 목표 | 실패 시 조치 |
|---|---|---|
| LCP | ≤ 2.0s | 지도 dynamic import, 상태 카드를 서버 렌더로 선반영 |
| INP | ≤ 200ms | 타임라인·시트 제스처를 rAF/transform 기반으로 |
| CLS | ≤ 0.05 | 모든 카드에 고정 높이 스켈레톤 |
| 초기 JS (지도 제외) | ≤ 180KB gzip | 번들 분석 CI 게이트 |
| MapLibre 청크 | 별도 지연 로드 | — |
| 지도 인터랙션 | 50~60fps | §12.3 적응형 파티클 |
| 레이어 전환 체감 | ≤ 500ms | 텍스처 프리페치(인접 레이어 1개) |
| 지점 상세 로드 | ≤ 1.0s (캐시 히트 시 ≤ 300ms) | 캐시 워밍 |
| CCTV 첫 프레임 | ≤ 3.0s | 저해상도 variant 우선, 썸네일 즉시 표시 |
| 조위 차트 렌더 | ≤ 100ms | SVG 사전 계산, 포인트 다운샘플 |

**성능 저하 시 희생 순서 (UI 자체는 절대 희생하지 않는다)**
1. 파티클 수 → 2. 격자 해상도 → 3. 애니메이션 갱신 주기 → 4. 오버레이 해상도

## 16.2 품질 게이트 (CI 필수 통과)
```
npm run typecheck     tsc --noEmit (strict)
npm run lint          eslint (하드코딩 문자열/색상 규칙 포함)
npm run test          vitest (유닛 — 어댑터 정규화, 해석 엔진, 물때 계산)
npm run test:e2e      playwright (주요 5 플로우 × 다크/라이트)
npm run a11y          axe-core (주요 5화면 × 2테마)
npm run i18n:check    로케일 키 정합성 (§8.7)
npm run analyze       번들 예산 초과 시 실패
```

## 16.3 에러 처리 / 관측
- Sentry: 프론트 + 서버 라우트 + Functions. 릴리즈 태깅, 소스맵 업로드.
- 구조화 로깅: `{ traceId, route, source, latencyMs, cacheHit, uid? }` — 개인정보 미포함.
- 데이터 소스 실패는 **사용자에게 조용히 숨기지 않는다.** "일부 정보를 불러오지 못했어요"를 카드 단위로 표시.
- Firestore `sourceHealth` 갱신 → 어드민 대시보드 반영 (§10.6).

---

# 17. 프로젝트 구조 & 코드 규약

## 17.1 폴더 구조

```text
barum/
├─ src/
│  ├─ app/
│  │  ├─ [locale]/
│  │  │  ├─ layout.tsx                # 테마·i18n·전역 프로바이더
│  │  │  ├─ page.tsx                  # 지도 홈 (화면 A)
│  │  │  ├─ spot/[spotId]/page.tsx    # 화면 B
│  │  │  ├─ tide/[stationId]/page.tsx # 화면 C
│  │  │  ├─ cctv/[[...id]]/page.tsx   # 화면 D
│  │  │  ├─ travel/...                # 화면 E
│  │  │  ├─ me/...                    # 마이페이지 (§9)
│  │  │  ├─ more/page.tsx
│  │  │  └─ legal/...
│  │  ├─ admin/                       # 어드민 (§10) — 별도 레이아웃
│  │  ├─ api/
│  │  │  ├─ v1/...                    # BFF (§4.3)
│  │  │  ├─ auth/session/route.ts
│  │  │  ├─ admin/...
│  │  │  ├─ cron/...                  # Vercel Cron 엔드포인트 (CRON_SECRET 검증)
│  │  │  └─ tiles/...
│  │  ├─ globals.css                  # 디자인 토큰 (§5.2)
│  │  └─ opengraph-image.tsx
│  │
│  ├─ components/
│  │  ├─ ui/                          # GlassControl, BottomSheet, SegmentedTabs, Badge …
│  │  ├─ map/                         # WeatherMap, LayerRail, WindParticleLayer,
│  │  │                               #  RasterLayer, CctvMarkers, TimelineSlider
│  │  ├─ weather/                     # CurrentWeatherCard, MetricCell, HourlyStrip, DailyList
│  │  ├─ tide/                        # TideChart, TideStrip, TideNarrative, SafetyBanner
│  │  ├─ cctv/                        # CctvCard, CctvPlayer, CctvSheet
│  │  ├─ advice/                      # AdviceCard, AdviceDetailSheet, ConfidenceBadge
│  │  ├─ travel/                      # RecommendCard, CategoryChips, CourseCard
│  │  ├─ me/                          # ProfileHeader, PlaceList, AlertRuleBuilder, LogbookEntry
│  │  ├─ admin/                       # DataTable, FormFields, AuditTrail …
│  │  └─ navigation/                  # BottomNav, DesktopSidebar
│  │
│  ├─ lib/
│  │  ├─ sources/                     # 외부 API 어댑터 (§11.5)
│  │  ├─ adapters/                    # → Normalized* 변환
│  │  ├─ advice/                      # 해석 엔진 (§7)
│  │  │  ├─ rules/{surf,fishing,mudflat,drive,photo,swim}.ts
│  │  │  ├─ score.ts  narrative.ts  confidence.ts
│  │  ├─ tide/                        # mulddae.ts, interpolate.ts, safety.ts
│  │  ├─ weather/                     # colorScale.ts, wind.ts, interpolation.ts, wxCodes.ts
│  │  ├─ grid/                        # 격자 디코더, 텍스처 업로더
│  │  ├─ firebase/                    # client.ts, admin.ts, auth.ts, firestore.ts
│  │  ├─ cache/                       # redis.ts, keys.ts, withCache.ts
│  │  ├─ units/                       # 단위 변환 (§8.4)
│  │  └─ utils/
│  │
│  ├─ hooks/                          # useTheme, useLocale, useGeolocation, useTimeCursor …
│  ├─ stores/                         # Zustand: mapStore, timeStore, uiStore, userStore
│  ├─ types/                          # weather.ts marine.ts cctv.ts user.ts admin.ts
│  ├─ i18n/                           # routing.ts request.ts navigation.ts
│  └─ env.ts                          # zod 환경변수 검증
│
├─ messages/                          # ko.json en.json zh-CN.json zh-TW.json ja.json
├─ workers/
│  ├─ grib-ingest/                    # Cloud Run Job (§12.1)
│  └─ cctv-thumbnail/                 # Cloud Run Job (ffmpeg)
├─ functions/                         # Firebase Functions v2 (헬스체크, 알림 엔진, 조석 배치)
├─ public/
│  ├─ icons/weather/*.svg
│  └─ firebase-messaging-sw.js
├─ e2e/                               # Playwright
├─ firestore.rules  storage.rules  firestore.indexes.json
├─ tailwind.config.ts  next.config.ts  middleware.ts
└─ AGENTS.md                          # 에이전트 진입 문서 (이 파일을 가리킴)
```

## 17.2 코드 규약

```
- TypeScript strict. any 금지(불가피하면 unknown + 타입가드).
- 서버 컴포넌트 기본. 'use client' 는 상호작용이 필요한 최소 경계에만.
- 데이터 페칭은 서버에서. 클라이언트 페칭은 TanStack Query 로 통일(폴링·재시도 정책 일관).
- 전역 상태는 Zustand. 지도 인스턴스는 ref 로 보관하고 상태에 넣지 않는다.
- 컴포넌트 파일 250줄 초과 시 분리 검토.
- 모든 공개 함수에 JSDoc 1줄 이상(무엇을/왜).
- 커밋: Conventional Commits. 브랜치: feat/*, fix/*, chore/*.
- PR 템플릿에 다크/라이트 스크린샷 2장 필수 (R12).
```

## 17.3 명명 규칙
```
컴포넌트   PascalCase          TideChart.tsx
훅         use + camelCase     useTimeCursor.ts
유틸       camelCase           toMulddae.ts
타입       PascalCase, 접두사 없음   NormalizedPoint (NOT INormalizedPoint)
상수       SCREAMING_SNAKE     WIND_SCALE
i18n 키    dot.case, 화면.요소  spot.tabs.hourly
Firestore  camelCase 필드, kebab-case 문서 id
```

---


# 19. 테스트 전략

| 레벨 | 대상 | 도구 |
|---|---|---|
| 유닛 | 어댑터 `normalize()`, 물때 계산, 해석 엔진 규칙, 단위 변환, 컬러 스케일 | Vitest + 저장된 raw 픽스처 |
| 계약 | 외부 API 응답 스키마 변경 감지 | zod 스키마 + 주간 스케줄 스모크 테스트 |
| 컴포넌트 | UI 카탈로그 전체 × 2테마 | Storybook + Chromatic(또는 Playwright 스냅샷) |
| E2E | ① 지도→지점 상세 ② 물때 조회 ③ CCTV 재생 ④ 로그인→즐겨찾기→알림 ⑤ 로케일 전환 | Playwright (모바일·데스크톱 뷰포트) |
| 접근성 | 주요 5화면 × 2테마 | axe-core |
| 성능 | 홈·지점상세 | Lighthouse CI (예산 초과 시 실패) |
| 보안 규칙 | Firestore rules | `@firebase/rules-unit-testing` — 타인 데이터 접근 차단 검증 필수 |

**중요 테스트 케이스 (반드시 포함)**
- 조석 경계: 자정 넘김, 하루 3회 만조, 관측소 데이터 결측
- 시간대: DST 없는 KST 고정, ISO 오프셋 파싱
- 외부 API: 429/500/타임아웃/빈 배열/부분 null
- 물때 체계: 남해식 vs 서해식 번호 차이
- 권한: viewer가 쓰기 API 호출 시 403

---

# 20. 분석 · 수익화

## 20.1 분석 이벤트 (GA4 또는 PostHog)
```
map_layer_change {layer, from}
time_cursor_move {deltaHours, method:'drag'|'play'|'tap'}
spot_open {spotId, source:'map'|'search'|'favorite'}
tide_view {stationId, mode:'basic'|'pro'}
cctv_play {cctvId, startMs, result}
advice_expand {activity, verdict}
confidence_badge_tap {level}
alert_rule_create {kind}
logbook_create {activity, hasPhoto}
locale_change {from, to}
theme_change {to}
safety_banner_shown / safety_alert_enabled
```
**북극성 지표**: `주간 재방문 사용자 중 지점 상세를 3회 이상 연 비율` (= 실사용 습관 형성)

## 20.2 수익화 원칙 (G3·G5 대응 — 경쟁사가 미움받는 지점을 피한다)
```
기본 원칙
  - 날씨·물때·CCTV 핵심 정보는 영구 무료. 15일 예보도 무료 (Windy와의 정면 차별점)
  - 정보 카드 영역·지도 위에는 광고를 넣지 않는다 (바다타임 불만 1위)
  - 광고를 넣는다면: 여행 탭의 명확히 구분된 '제휴' 라벨 카드 한정

수익 모델 (우선순위)
  1. 지역 제휴: 서핑샵·낚시배·카페·숙소 — 조건 매칭 기반 추천 (사용자에게도 유용)
  2. B2B 데이터/위젯: 숙소·해변 운영자용 임베드 위젯, 어촌계 대시보드
  3. 관광 기관 협업: 다국어 관광 정보 제공 (G11이 공공 가치와 맞물림)
  4. 프리미엄(선택): 알림 규칙 무제한, 로그북 무제한 사진, 광고 제거
     — 단, 핵심 정보 잠금은 금지
```

---

# 21. 법적 · 데이터 출처 · 윤리

## 21.1 출처 표기 (필수)
- 모든 화면의 데이터 카드에 출처·기준 시각 (R7)
- `/legal/sources` 페이지에 전체 목록: 기상청, 국립해양조사원, NOAA, ECMWF, Open-Meteo, 제주특별자치도(CCTV), 지도 타일 제공자
- 각 API의 이용약관·출처 표기 요구사항을 준수한다. **상업적 이용이 제한된 API는 사용 전 확인** (KHOA 일부 API는 상업적 이용 제한 및 트래픽 초과 시 사용 제한 조항이 있다)
- 지도 타일·베이스맵 저작권 표기를 지도 좌하단에 상시 노출

## 21.2 CCTV
- 제공 기관의 재배포 허용 여부 확인 후 임베드/링크 방식 결정 (§13.5)
- 출처 표기 문구는 어드민에서 CCTV별로 설정 가능
- 개인 식별 가능한 근접 영상 미취급

## 21.3 안전 면책 (R10)
- 안전 기능이 있는 모든 화면에 면책 문구 고정 노출
- "예보는 참고용이며 실제와 다를 수 있습니다. 반드시 공식 기상특보를 확인하세요."
- 긴급 연락처: 해양경찰 **122**, 소방 **119**

## 21.4 개인정보
- 수집 최소화: 이메일, 닉네임, (선택) 프로필 사진, 활동 프로필, 즐겨찾기 지점
- 위치: 실시간 조회에만 사용, 서버 저장 금지(즐겨찾기로 명시 저장한 지점 제외)
- 위치기반서비스 이용약관 별도 고지·동의
- 데이터 이동권(내보내기)·삭제권(30일 유예) 제공 (§9.4 ⑧)
- 개인정보처리방침·약관은 5개 언어 제공

## 21.5 오픈소스
- `/legal/oss` 에 의존성 라이선스 목록 자동 생성(`license-checker`)
- **GPL 계열 코드를 프로덕션 번들에 포함하지 않는다** (§12.4, §0.3 승인 항목)

---

