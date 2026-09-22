> 바름닷컴 스펙 · 3 해석엔진·다국어·알림안전 · [← AGENTS.md](../AGENTS.md)


# 7. 해석 엔진 (Advice Engine) — 제품의 핵심 차별점 (G4, G7, G9)

> "수치 → 문장"을 담당하는 서버 모듈. `src/lib/advice/` 에 위치하며, **규칙 기반(결정론적)** 으로 구현한다. LLM은 선택적 문장 다듬기에만 사용하고, 판정 자체는 절대 LLM에 맡기지 않는다(재현성·책임).

## 7.1 지수 산출 구조

```ts
type Activity = 'surf' | 'fishing' | 'mudflat' | 'drive' | 'photo' | 'swim';
type Verdict  = 'great' | 'good' | 'fair' | 'caution' | 'danger';

interface AdviceResult {
  activity: Activity;
  score: number;            // 0~100
  verdict: Verdict;
  headline: string;         // i18n 키 + 파라미터 (예: advice.surf.fair)
  reason: string;           // 한 줄 근거
  factors: Array<{          // 근거 펼침용
    key: 'wave' | 'wind' | 'tide' | 'temp' | 'rain' | 'visibility' | 'current';
    value: number; unit: string;
    contribution: number;   // -100 ~ +100
    label: string;          // i18n 키
  }>;
  bestWindow?: { from: string; to: string; label: string }; // "오후 2~5시 추천"
  confidence: 'high' | 'medium' | 'diverging';
  updatedAt: string;
}
```

## 7.2 활동별 판정 규칙 (초기값 — Remote Config로 조정 가능)

| 활동 | 주요 변수 | 최적 구간 | 위험 컷오프 |
|---|---|---|---|
| **서핑** | 파고, 파주기, 풍속, 풍향(오프쇼어 가산), 수온 | 파고 0.8~1.8m, 주기 ≥7s, 풍속 ≤6m/s | 파고 ≥3.0m 또는 풍속 ≥12m/s → `danger` |
| **낚시(생활)** | 물때(조류 세기), 파고, 풍속, 강수, 기압 변화 | 물때 5~10물, 파고 ≤1.0m, 풍속 ≤7m/s | 파고 ≥2.0m, 풍속 ≥10m/s, 특보 발효 → `danger` |
| **해루질/갯벌** | 간조 시각, 조차, 일몰, 파고, 수온 | 간조 ±1.5h, 조차 큰 날(사리 전후) | **간조 후 밀물 시작 1h 이내는 무조건 `caution` 이상**, 야간+밀물 → `danger` |
| **드라이브** | 강수, 시정, 풍속, 노을 지수(일몰 전후 구름량) | 강수 0, 시정 ≥10km | 강풍·호우주의보 → `caution` |
| **사진/노을** | 일몰 시각, 중·상층 운량(30~70%가 최적), 시정, 강수 | 운량 40~60% | — |
| **해수욕** | 수온, 파고, 이안류 위험도, 자외선 | 수온 ≥23°, 파고 ≤0.8m | 이안류 주의보, 파고 ≥1.5m → `danger` |

**점수 산출**: 각 변수를 0~1로 정규화한 가중합 → 0~100. **위험 컷오프는 점수와 무관하게 verdict를 강등**한다(안전 우선).

**출력 문장 예시 (시안 1과 동일한 톤)**
```
서핑  보통      오전엔 잔잔, 오후에 파도 살아나요.
낚시  오후 추천  오후부터 조류가 좋아집니다.
```

## 7.3 물때 자연어 변환기 (G7)

```ts
describeTide(now, tideSeries) → {
  phase: 'rising' | 'falling' | 'nearHigh' | 'nearLow',
  sentence: string,    // "지금은 물이 차오르는 중이에요"
  nextEvent: { type: 'high'|'low', at: string, inMinutes: number },
  mulddae: { number: 8, name: '8물', spring: boolean, neap: boolean,
             plain: '물살이 제법 세게 흐르는 날' }
}
```
- 용어(`사리`, `조금`, `창조`, `낙조`, `몇물`)는 **툴팁 사전**(`messages/{locale}.json` 의 `glossary.*`)과 연결한다.
- 물때 번호 체계는 **서해식(7물때)과 남해/제주식**이 다르므로, 지점 메타에 `tideSystem` 필드를 두고 지역별로 올바른 체계를 적용한다. 제주는 남해식 기준.

## 7.4 신뢰도 산정 (G9)

```
1) 같은 시점에 대해 KMA / GFS / ECMWF 값이 모두 있으면 분산 계산
2) 핵심 변수(기온·풍속·강수)의 정규화 분산이
     < 0.10 → 'high'      (배지: 신뢰도 높음)
     < 0.25 → 'medium'    (배지: 보통)
     ≥ 0.25 → 'diverging' (배지: 예보 갈림 ⚠, 탭 시 모델별 비교표)
3) 관측값(실황)이 있는 현재 시점은 항상 'high'
4) +7d 이후는 상한을 'medium' 으로 캡
```
이 배지가 사용자가 다른 앱을 열지 않게 만드는 장치다. **비교표에는 각 모델의 값과 발표 시각을 그대로 노출한다.**

## 7.5 여행 추천 매칭 (G10)

```
score(place) =
    0.45 × activityFit(place.activityTags, currentConditions)   // 해석 엔진 점수 재사용
  + 0.20 × weatherFit(place.indoor, rain, wind)                 // 비/강풍이면 indoor 가산
  + 0.15 × proximity(userLocation, place.location)
  + 0.10 × timeFit(place.bestTimeOfDay, now)                    // 일몰 명소는 일몰 1h 전 가산
  + 0.10 × personalization(userProfile, place)                  // 좋아요/로그북 이력
```
- 비 또는 풍속 ≥10m/s 면 `indoor=true` 장소 가중치를 1.8배로 곱한다 (G10의 "비 오면 뭐하지" 해결).
- 추천 이유는 반드시 카드에 수치로 표기한다("파도 1.0m · 바람 적당").

## 7.6 LLM 사용 범위 (선택 기능, Phase 7)
- 허용: 규칙 엔진이 산출한 `factors` 를 입력으로 **문장 다듬기·다국어 자연화**.
- 금지: verdict 결정, 안전 경고 생성, 수치 추정.
- 구현 시 결과는 Firestore `adviceCache/{spotId}_{hour}_{locale}` 에 캐시하고, 실패 시 규칙 기반 템플릿 문장으로 폴백한다.

---


# 8. 다국어(i18n) 설계 (G11)

## 8.1 지원 로케일 및 우선순위

| 로케일 | 언어 | 근거 | 우선순위 |
|---|---|---|---|
| `ko` | 한국어 | 기본 | P0 |
| `zh-CN` | 중국어 간체 | 제주 외국인 관광객의 **70.2%** | P0 |
| `en` | 영어 | 국제 공통 | P0 |
| `zh-TW` | 중국어 번체 | 대만 **10.4%** (+홍콩 2.2%) | P1 |
| `ja` | 일본어 | 일본 **3.7%**, 2026 상반기 +64% 증가세 | P1 |

## 8.2 기술 선택 — `next-intl`

App Router/RSC 환경에서 서버 컴포넌트 내 번역 로딩이 워크어라운드 없이 동작하고, 미들웨어 기반 로케일 협상과 타입 안전한 키를 제공하므로 `next-intl` 을 채택한다.

```
src/
  i18n/
    routing.ts          defineRouting({ locales, defaultLocale: 'ko', localePrefix: 'as-needed' })
    request.ts          getRequestConfig — 메시지 로딩
    navigation.ts       Link, useRouter, redirect 래퍼
  messages/
    ko.json  en.json  zh-CN.json  zh-TW.json  ja.json
middleware.ts           로케일 협상 + 인증 쿠키 검사 (§9.2)
```

**라우팅**: `localePrefix: 'as-needed'` — 한국어는 `/`, 그 외는 `/en`, `/zh-CN` …
**감지 순서**: ① URL 접두사 → ② 쿠키 `NEXT_LOCALE` → ③ 로그인 사용자 설정 → ④ `Accept-Language` → ⑤ `ko`
**SEO**: 각 페이지에 `alternates.languages` hreflang, `x-default` = ko. sitemap은 로케일별로 생성.

## 8.3 번역 대상 (UI 문자열만이 아니다 — 이게 핵심)

| 계층 | 대상 | 저장 위치 | 담당 |
|---|---|---|---|
| **L1 UI 문자열** | 버튼, 라벨, 탭, 오류 메시지 | `messages/{locale}.json` | 개발/번역가 |
| **L2 도메인 용어** | 물때 용어(사리/조금/몇물), 풍향(서풍/북서풍), 날씨 상태(구름 조금) | `messages/{locale}.json` 의 `glossary.*`, `wx.*` | 전문 감수 필수 |
| **L3 지명(POI)** | 애월, 협재 해변, 한라산, 곽지 해변 | Firestore `spots/{id}.name` = `{ ko, en, zhCN, zhTW, ja }` | 어드민 |
| **L4 콘텐츠** | 여행 추천 설명, 코스, 공지 | Firestore `places/`, `courses/`, `notices/` 의 i18n 맵 | 어드민 |
| **L5 해석 문장** | "오전엔 잔잔, 오후에 파도 살아나요" | 템플릿 키 + 파라미터. `advice.surf.fair` 등 | 개발 |
| **L6 안전 문구** | 고립 경고, 면책, 122 안내 | `messages/{locale}.json` 의 `safety.*` | **법무/전문 감수 필수, 기계번역 금지** |

**규칙**: L3/L4는 번역 누락 시 `ko` 로 폴백하되, UI에 `번역 준비 중` 배지를 표시하고 어드민 번역 대시보드(§10.5)에 누락 건으로 집계한다.

## 8.4 포맷팅 규칙

```ts
// 날짜/시간: 항상 Asia/Seoul 기준으로 계산하되 표시는 로케일 포맷
Intl.DateTimeFormat(locale, { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })
// ko: 09:41  en: 9:41 AM  ja: 09:41  zh-CN: 09:41

// 숫자: 소수점 자리수 고정 (파고 1자리, 기온 1자리, 풍속 1자리)
// 단위: 사용자 설정 우선, 로케일 기본값은 아래
```

| 항목 | ko / zh / ja 기본 | en 기본 | 사용자 변경 가능 |
|---|---|---|---|
| 기온 | °C | °C | °C / °F |
| 풍속 | m/s | m/s | m/s / km/h / knots / mph |
| 파고·조위 | m | m | m / ft |
| 거리 | km | km | km / mi |
| 시간 | 24h | 12h | 12h / 24h |

**풍향 표기**: ko는 `서풍`, en은 `W (270°)`, ja는 `西風`, zh는 `西风`. 16방위 문자열은 `messages` 에 배열로 정의하고 각도→인덱스로 매핑한다.

## 8.5 폰트 로딩

```
ko           : Pretendard Variable (subset: korean)
en           : Pretendard Variable (latin)
zh-CN        : Noto Sans SC  (동적 subset, next/font + display: swap)
zh-TW        : Noto Sans TC
ja           : Noto Sans JP
```
로케일별로 필요한 폰트만 로드한다(`next/font` 의 조건부 적용). CJK 폰트는 용량이 크므로 **반드시 subset + preload 제한**.

## 8.6 번역 파일 구조 예시

```jsonc
// messages/ko.json
{
  "nav": { "tide": "물때", "cctv": "CCTV", "home": "바름닷컴", "travel": "여행", "more": "더보기" },
  "map": { "searchPlaceholder": "지역 검색", "myLocation": "현위치" },
  "layer": { "wind": "바람", "rain": "강수", "temp": "기온", "wave": "파도", "tide": "물때" },
  "metric": { "wind": "{dir}풍", "wave": "파고", "rain": "강수", "seaTemp": "수온", "feelsLike": "체감 {v}°" },
  "tide": {
    "todayTitle": "오늘의 조위 ({station})",
    "toHigh": "만조까지 {h}시간 {m}분",
    "rising": "지금은 물이 차오르는 중이에요.",
    "falling": "지금은 물이 빠지는 중이에요.",
    "mulddae": "{n}물"
  },
  "advice": {
    "sectionTitle": "오늘의 한마디",
    "surf": { "fair": "보통", "reason.fair": "오전엔 잔잔, 오후에 파도 살아나요." },
    "fishing": { "afternoon": "오후 추천", "reason.afternoon": "오후부터 조류가 좋아집니다." }
  },
  "safety": {
    "returnBy": "간조 {t}까지 복귀를 권장합니다.",
    "callCoastGuard": "해양경찰 122",
    "disclaimer": "본 정보는 참고용이며, 실제 현장 상황과 다를 수 있습니다."
  },
  "glossary": {
    "mulddae.title": "물때란?",
    "mulddae.body": "달의 영향으로 바닷물이 드나드는 정도를 숫자로 나타낸 것입니다. 숫자가 클수록 물살이 셉니다."
  },
  "confidence": { "high": "신뢰도 높음", "medium": "보통", "diverging": "예보 갈림" }
}
```

## 8.7 i18n 품질 게이트 (CI)
- `npm run i18n:check` — ① 로케일 간 키 누락/과잉 검사, ② 미사용 키 검출, ③ 하드코딩 한글 문자열 lint(`eslint-plugin-i18next` 유사 규칙), ④ 파라미터 불일치 검사.
- 실패 시 빌드 차단. (R5 강제 수단)
---


# 14. 알림 & 안전 (G8, G13)

## 14.1 기술 스택
```
Firebase Cloud Messaging (Web Push)
  - public/firebase-messaging-sw.js  (서비스워커)
  - VAPID 키: NEXT_PUBLIC_FIREBASE_VAPID_KEY
  - 토큰 저장: Firestore users/{uid}/devices/{token}  (lastSeenAt, platform, locale)
  - iOS Safari는 홈 화면 추가(PWA) 상태에서만 웹푸시 가능 → 안내 배너 제공
폴백: 이메일(Resend 또는 SendGrid), 인앱 알림함
```

## 14.2 알림 평가 엔진
```
Cloud Functions 스케줄 (10분 주기)
1) 활성 규칙을 지점별로 그룹핑 (같은 지점은 예보를 1회만 조회)
2) 지점 예보 조회 (내부 캐시 사용 — 외부 API 재호출 금지)
3) 규칙 매칭 → 매칭 시:
   - 중복 억제: 같은 규칙은 6시간 내 재발송 금지
   - 조용 시간 확인 (안전 알림 C는 예외)
   - 하루 최대 건수 확인
4) FCM 발송 + Firestore users/{uid}/notifications 에 기록
5) 실패 토큰은 정리 (unregistered → 삭제)
```

**멱등성**: 발송 키 `{ruleId}_{targetTimeBucket}` 으로 중복 발송을 차단한다.

## 14.3 안전 모드 — 고립 사고 예방 (G8, 이 제품의 사회적 명분)

> 근거: 최근 5년간 갯벌·갯바위 고립사고 983건, 사망 115명. 대부분 **물때를 놓쳐서** 발생.

```
트리거 조건 (자동)
  - 사용자가 유형이 'rock' 또는 'mudflat' 인 지점을 조회
  - 또는 위치 권한 허용 + 해안선 200m 이내에 체류 5분 이상 (옵트인)

표시 (SafetyBanner §5.4.16)
  복귀 권장 시각 = 간조시각 - 60분   (해수부 3대 안전수칙 기준)
  남은 시간 카운트다운
  "구명조끼 착용" 리마인더
  [해양경찰 122] 탭투콜  [안전 알림 받기] 원탭 등록

푸시
  T-90분 : "곧 물이 들어옵니다. 15:20까지 나오세요"
  T-60분 : "지금 이동을 시작하세요"  (조용시간 무시, 고우선순위)
  T-30분 : "위험 — 즉시 육상으로"

오프라인
  즐겨찾기 지점의 7일치 조석을 IndexedDB에 사전 캐시.
  네트워크가 끊겨도 카운트다운은 계속 동작한다. (현장은 대부분 통신이 나쁘다)

면책 (R10)
  "본 정보는 참고용이며 실제 현장 상황과 다를 수 있습니다. 반드시 구명조끼를 착용하고
   기상·해양 특보를 확인하세요. 긴급 시 해양경찰 122."
```

## 14.4 인앱 알림함
- 헤더 벨 아이콘 + 미확인 뱃지. 알림 종류별 필터. 각 항목에 딥링크.
- "이 알림이 유용했나요 👍👎" — 규칙 품질 개선 신호로 수집.

---

