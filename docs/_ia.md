> 바름닷컴 스펙 · 02 정보구조·라우팅·API 계약 · [← 인덱스](00-INDEX.md)

# 4. 정보 구조(IA) & 라우팅

## 4.1 하단 네비게이션 (불변 구조)

```
 물때   |   CCTV   |   [ 바름닷컴 ]   |   여행   |   더보기
                          ↑ 중앙 FAB = 지도 홈 복귀 (항상 고정)
```

## 4.2 라우트 맵

```text
/[locale]/                         지도 홈 (화면 A)
/[locale]/spot/[spotId]            지역 상세 (화면 B) — 바텀시트 + 딥링크 가능한 전체 페이지
/[locale]/tide                     물때 허브 (지점 선택)
/[locale]/tide/[stationId]         물때 상세 (화면 C)
/[locale]/cctv                     CCTV 허브 (화면 D — 목록/지도 토글)
/[locale]/cctv/[cctvId]            CCTV 단독 뷰
/[locale]/travel                   여행/추천 (화면 E)
/[locale]/travel/place/[placeId]   추천 장소 상세
/[locale]/travel/course/[courseId] 추천 코스 상세
/[locale]/more                     더보기
/[locale]/me                       마이페이지 허브              (§9)
/[locale]/me/places                내 장소
/[locale]/me/alerts                내 알림 규칙
/[locale]/me/logbook               내 기록(로그북)
/[locale]/me/logbook/[entryId]     기록 상세
/[locale]/me/reports               내 제보
/[locale]/me/settings              앱 설정(언어/단위/테마)
/[locale]/me/account               계정·보안·데이터
/[locale]/auth/sign-in             로그인
/[locale]/legal/terms|privacy|sources|oss
/admin/**                          어드민 (로케일 라우팅 미적용, ko/en 고정)  (§10)
```

## 4.3 API 라우트 (BFF)

```text
GET  /api/v1/point?lat&lng&at                지점 종합(날씨+해양+물때 요약)
GET  /api/v1/forecast/hourly?spotId&h=48
GET  /api/v1/forecast/daily?spotId&d=15
GET  /api/v1/tide/{stationId}?date
GET  /api/v1/tide/nearest?lat&lng
GET  /api/v1/cctv                            목록(+상태)
GET  /api/v1/cctv/{id}                       상세(+스트림 URL)
GET  /api/v1/advice?spotId&activity          해석 엔진 결과 (§7)
GET  /api/v1/recommend?lat&lng&activity      여행 추천
GET  /api/v1/search?q&locale                 지역/지점 검색
POST /api/v1/reports                         현장 제보 (인증)
GET  /api/v1/me/*                            마이페이지 데이터 (인증)
POST /api/v1/alerts/rules                    알림 규칙 CRUD (인증)
GET  /api/tiles/{layer}/{run}/{z}/{x}/{y}.webp   기상 타일 (§12)
GET  /api/grid/{layer}/{run}/{step}.bin          U/V 격자 바이너리 (§12)
ALL  /api/admin/*                            어드민 (role claim 검증)
```

**응답 계약 (전 엔드포인트 공통, R7)**

```jsonc
{
  "data": { /* ... */ },
  "meta": {
    "source": "KMA_ULTRA_SRT_NCST",      // 출처 코드
    "sourceLabel": "기상청 초단기실황",     // i18n 키로 변환 가능한 라벨
    "issuedAt": "2026-09-22T09:00:00+09:00",  // 데이터 발표/관측 시각
    "fetchedAt": "2026-09-22T09:41:12+09:00", // 서버 수집 시각
    "confidence": "high",                 // high | medium | diverging
    "station": { "id": "DT_0004", "name": "제주", "distanceKm": 12.3 },
    "cacheTtlSec": 300
  },
  "error": null
}
```
---

