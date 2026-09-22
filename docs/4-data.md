> 바름닷컴 스펙 · 4 데이터소스·지도레이어·CCTV · [← AGENTS.md](../AGENTS.md)


# 11. 데이터 소스 & 어댑터 계층

## 11.1 두 종류 데이터의 절대 분리 (R2)

| | **A. 지점(Point) 데이터** | **B. 격자(Grid) 데이터** |
|---|---|---|
| 목적 | 특정 좌표의 수치 표시 | 지도 전면 색상·파티클 렌더 |
| 예 | 애월 23°, 풍속 4.8m/s, 파고 0.8m | 제주 전역 바람장, 강수 래스터 |
| 소스 | KMA API, KHOA API, Open-Meteo | GRIB2 (GFS / ECMWF / KMA 격자) |
| 처리 | 서버에서 정규화 + 캐시 | 사전 배치 변환 → 타일/텍스처 → CDN |
| 호출 | 요청 시 (캐시 TTL 5~60분) | 모델 run 갱신 시 배치 (§12) |
| **금지** | — | **지점 API를 격자처럼 N회 호출하는 것** |

## 11.2 내부 정규화 타입 (R3 — UI는 이것만 본다)

```ts
// src/types/weather.ts
export interface NormalizedPoint {
  location: { lat: number; lng: number; spotId?: string };
  time: string;                  // ISO8601 +09:00
  temperature: number | null;    // °C
  feelsLike: number | null;
  condition: WxCode;             // 'clear'|'partly'|'cloudy'|'rain'|'snow'|'shower'|'fog'|'thunder'
  humidity: number | null;       // %
  pressure: number | null;       // hPa
  visibility: number | null;     // km
  uvIndex: number | null;
  wind: { speed: number; gust: number | null; direction: number; u: number; v: number } | null;
  precipitation: { amount: number | null; probability: number | null; type: 'rain'|'snow'|'mixed'|null };
  sky: { cloudCover: number | null };
}

// src/types/marine.ts
export interface NormalizedMarine {
  waveHeight: number | null;     // m (유의파고)
  wavePeriod: number | null;     // s
  waveDirection: number | null;  // deg
  swellHeight: number | null;
  seaTemperature: number | null; // °C
  current: { speed: number; direction: number } | null;  // cm/s, deg
  ripCurrentRisk: 'low'|'medium'|'high'|null;
}

export interface NormalizedTide {
  stationId: string; stationName: string; distanceKm: number;
  tideSystem: 'south'|'west';
  current: { level: number; phase: 'rising'|'falling'|'nearHigh'|'nearLow'; at: string };
  events: Array<{ type: 'high'|'low'; at: string; level: number }>;
  series: Array<{ at: string; level: number }>;   // 10분 간격 24h
  mulddae: { number: number; label: string; spring: boolean; neap: boolean };
  sun: { rise: string; set: string };
  moon: { rise: string | null; set: string | null; phase: number };
  seaTemperature: number | null;
  observed: boolean;             // 실측 여부 (false면 예측값)
}

export interface Envelope<T> { data: T; meta: SourceMeta; error: ApiError | null }
```

## 11.3 소스 우선순위 엔진 (G1 — 이 로직이 정확도의 핵심)

```ts
// src/lib/sources/priority.ts
function selectWeatherSource(leadTimeHours: number, isKorea: boolean) {
  if (!isKorea) return ['OPEN_METEO', 'GFS'];
  if (leadTimeHours <= 0)  return ['KMA_ULTRA_NCST', 'KMA_ASOS_AWS', 'OPEN_METEO'];   // 실황
  if (leadTimeHours <= 6)  return ['KMA_ULTRA_FCST', 'KMA_SHORT_FCST', 'OPEN_METEO'];
  if (leadTimeHours <= 72) return ['KMA_SHORT_FCST', 'OPEN_METEO', 'ECMWF'];
  if (leadTimeHours <= 240)return ['KMA_MID_FCST', 'ECMWF', 'GFS'];
  return ['ECMWF', 'GFS'];                                                            // ~15일
}

function selectMarineSource(kind: 'tide'|'seaTemp'|'wave'|'current', hasKhoaStation: boolean) {
  switch (kind) {
    case 'tide':     return ['KHOA_TIDE_PRED', 'KHOA_TIDE_OBS'];        // 국내 공식 우선, 예외 없음
    case 'seaTemp':  return hasKhoaStation ? ['KHOA_OBS_TEMP', 'KMA_BUOY', 'OPEN_METEO_MARINE']
                                           : ['KMA_BUOY', 'OPEN_METEO_MARINE'];
    case 'wave':     return ['KMA_BUOY_OBS', 'KMA_WW3', 'OPEN_METEO_MARINE'];
    case 'current':  return ['KHOA_CURRENT', 'KHOA_KOOFS'];
  }
}
```
**규칙**: 앞 소스가 실패하거나 값이 `null`이면 다음 소스로 폴백하고, `meta.source` 는 **실제 사용된 소스**를 기록한다. 폴백이 발생하면 `confidence` 를 한 단계 낮춘다.

## 11.4 지점 ↔ 관측소 매핑 & 보간 (G14)

```
1) 지점(Spot)마다 사전 매핑을 갖는다 (어드민에서 관리, §10.4)
   - kmaGrid: { nx, ny }            동네예보 격자 (좌표→격자 변환식은 기상청 공식 Lambert Conformal 사용)
   - khoaStation: 최근접 조위관측소 id + 거리
   - buoyStation: 최근접 해양기상부이 id + 거리
2) 관측소가 20km 이상 떨어져 있으면:
   - 값 옆에 "인근 {station}관측소 기준 ({distance}km)" 를 반드시 표기한다
   - confidence 를 'medium' 으로 강등
3) 조위는 보간하지 않는다. 조석은 지형 의존성이 커서 선형 보간이 위험하다.
   대신 가장 가까운 관측소 값을 그대로 쓰고 관측소명을 노출한다.
4) 기온·풍속은 인접 격자 4점 쌍선형 보간(bilinear) 허용.
5) 물리 범위 검증: 기온 -30~45°, 풍속 0~80m/s, 파고 0~20m, 수온 -2~35°.
   벗어나면 null 처리 + 어드민 이상치 큐(§10.6)에 적재.
```

## 11.5 어댑터 목록 및 책임

```
src/lib/sources/
  kma/
    ultraNcst.ts      초단기실황 (매시 40분 발표, 1시간 단위)
    ultraFcst.ts      초단기예보 (매시 45분 발표, +6h, 1시간 단위)
    shortFcst.ts      단기예보 (02/05/08/11/14/17/20/23시 발표, +3일)
    midFcst.ts        중기예보 (06/18시 발표, 3~10일)
    warning.ts        기상특보
    buoy.ts           해양기상부이 관측
    grid.ts           좌표 ↔ 격자(nx,ny) 변환 유틸
  khoa/
    tidePrediction.ts 조석예보 (고조/저조)
    tideObservation.ts 조위관측소 실측·예측 조위
    seaTemp.ts        조위관측소 실측 수온
    current.ts        조류 예보
    station.ts        관측소 목록/좌표
  openmeteo/
    forecast.ts       폴백 지점 예보
    marine.ts         파고·파주기·너울·해수면온도 (최대 16일)
  global/
    gfs.ts            NOAA NOMADS GRIB Filter (0.25°)
    ecmwf.ts          ECMWF Open Data (0.25°)
  cctv/
    registry.ts       Firestore CCTV 목록
    health.ts         HLS 헬스체크
  adapters/
    toNormalizedPoint.ts
    toNormalizedMarine.ts
    toNormalizedTide.ts
```

**어댑터 작성 규칙**
1. 각 어댑터는 `fetchRaw()` 와 `normalize(raw)` 를 분리한다. 테스트는 저장된 raw 픽스처로 `normalize` 만 검증한다.
2. 외부 호출은 `withRetry(3, exponential)` + `withTimeout(8s)` + `withCircuitBreaker` 로 감싼다.
3. 모든 응답은 `zod` 스키마로 파싱한다. 파싱 실패는 예외가 아니라 `error` 로 전파하고 폴백 소스를 시도한다.
4. **KMA 응답의 `SKY`/`PTY` 코드 → `WxCode` 매핑 테이블은 한 곳(`kma/codes.ts`)에만 존재한다.**
5. 시각은 항상 `Asia/Seoul` 로 파싱하고 내부적으로는 ISO8601(offset 포함) 문자열로 유지한다.

## 11.6 캐시 전략

| 데이터 | TTL | 무효화 | 저장소 |
|---|---|---|---|
| KMA 초단기실황 | 5분 | 매시 45분 | Vercel Data Cache + Upstash Redis |
| KMA 초단기예보 | 10분 | 매시 50분 | 〃 |
| KMA 단기예보 | 45분 | 발표 시각 +10분 | 〃 |
| KMA 중기예보 | 3시간 | 06/18시 +30분 | 〃 |
| KHOA 조석예보 | **24시간** (하루치 사전 계산) | 매일 00:10 배치 | Firestore `tideCache` |
| KHOA 실측 조위/수온 | 10분 | — | Redis |
| Open-Meteo Marine | 30분 | — | Redis |
| 격자 타일/텍스처 | 모델 run 주기 | 새 run 생성 시 | Blob/R2 + CDN `immutable` |
| CCTV 목록 | 5분 | 어드민 수정 시 즉시 | Firestore + ISR revalidateTag |
| 여행 콘텐츠 | 1시간 | 어드민 발행 시 revalidateTag | ISR |

**원칙**: 사용자 요청이 외부 API를 직접 때리지 않는다. 항상 `사용자 → 우리 API → 캐시 → (미스 시) 외부 API`.
**KHOA 일일 20,000건 제한**을 절대 초과하지 않도록, 조석은 **매일 새벽 전 지점 일괄 선계산** 후 캐시에서만 서빙한다.

---


# 12. 지도 기상 레이어 파이프라인 (격자 데이터)

## 12.1 전체 흐름

```
NOAA NOMADS (GFS 0.25°, GRIB Filter로 영역 절단)
ECMWF Open Data (0.25° GRIB2)
        │
        ▼  [Ingest Worker — Cloud Run Job, Node 또는 Python]
   영역 절단: lon 124~128E, lat 31.5~35N  (제주 + 인근 해역)
   변수 추출: UGRD/VGRD(10m), TMP(2m), APCP, HTSGW(파고)
        │
        ▼
   ① U/V 격자 → Float16 바이너리 (.bin) + 메타 JSON   ← 파티클 렌더용
   ② 스칼라 → 컬러맵 적용 전 값 그대로 PNG/WebP 타일  ← 래스터 오버레이용
        │
        ▼
   Vercel Blob 또는 Cloudflare R2 (경로에 model+run 포함 → immutable 캐시)
        │
        ▼
   CDN  →  MapLibre Custom Layer (WebGL2)  →  사용자 지도
```

## 12.2 데이터 규격

```
영역: lonMin 124.0, lonMax 128.0, latMin 31.5, latMax 35.0
해상도: 0.25° (약 25km) → 폭 17 × 높이 15 격자
  ⚠ 이 해상도로는 제주 연안 표현이 거칠다. 따라서:
    - 지도 렌더용으로는 쌍선형 업샘플링 (텍스처 보간으로 GPU가 처리)
    - 지점 수치는 절대 격자에서 읽지 않는다 (§11.1 R2)
시간 스텝: +0h ~ +120h 는 3시간, +120h ~ +360h 는 6시간
run: GFS 00/06/12/18Z, ECMWF 00/12Z
파일 경로: /grid/{model}/{runISO}/{variable}/{stepHours}.bin
          /tiles/{model}/{runISO}/{variable}/{z}/{x}/{y}.webp
```

**저장 용량 추정**: 제주 영역 0.25° 격자는 격자점이 255개에 불과하므로 한 스텝당 수 KB 수준. 전체 run(약 60스텝 × 4변수)도 1MB 미만 → **비용 부담이 거의 없다.** 전국·동아시아로 확장 시 재산정한다.

## 12.3 바람 파티클 렌더러

**구현 방식**: MapLibre `CustomLayerInterface` + WebGL2. GPU에서 파티클 위치를 텍스처로 관리(ping-pong FBO).

```
1) U/V 격자를 RG16F 텍스처로 업로드 (U→R, V→G)
2) 파티클 상태 텍스처(위치 x,y + 수명) 생성
3) 매 프레임:
   - update 패스: 현재 위치에서 텍스처 샘플링(bilinear) → 속도 → 위치 갱신 → 수명 감소
   - draw 패스: 이전 프레임 페이드(alpha 0.96) 위에 선분으로 그림 (트레일 효과)
4) 수명이 다한 파티클은 랜덤 재배치 (속도 0 영역 정체 방지)
```

**적응형 밀도 (필수 구현)**
```
초기값:  모바일 4,000 / 태블릿 8,000 / 데스크톱 16,000
FPS 모니터(1초 이동평균):
  < 45fps 2초 지속 → 파티클 25% 감소 (최소 1,500)
  > 57fps 5초 지속 → 파티클 15% 증가 (최대 30,000)
배터리 절약 모드 / prefers-reduced-motion / 데이터 절약 설정 → 파티클 끄고 정적 화살표 필드
탭 비활성(visibilitychange) → 렌더 루프 정지
```

**시간 보간**: 두 스텝 텍스처를 셰이더에서 `mix(t0, t1, frac)` 로 섞는다. 타임라인 드래그 중에도 끊김 없이 동작해야 한다.

## 12.4 라이브러리 선택 — **라이선스 주의 (확인 필요 항목)**

| 후보 | 라이선스 | 판단 |
|---|---|---|
| **직접 구현** (MapLibre CustomLayer + WebGL2) | — | **권장 (기본안)**. 제어권·성능·라이선스 자유. 시안의 비주얼을 정확히 재현하려면 어차피 커스텀이 필요 |
| `@openmeteo/weather-map-layer` | **GPL-2.0** | ⚠ **강한 copyleft — 상용 클로즈드 서비스에 부적합할 수 있음.** 채택하려면 반드시 사전 승인(§0.3) |
| WeatherLayers GL | MPL(오픈소스 파트) + 상용 서비스 | 파일 단위 copyleft라 상대적으로 안전하나, 클라우드 서비스 의존도 확인 필요 |
| `maplibre-gl-wind` (geoql) | 확인 필요 | deck.gl 의존. 참고 구현으로만 |
| `wind-layer` | 확인 필요 | 참고 구현으로만 |

**결정**: Phase 5에서는 **직접 구현**을 기본으로 한다. 참고 구현들은 알고리즘 학습용으로만 읽고, **코드를 복사하지 않는다.**

## 12.5 스칼라 레이어 (강수·기온·파도)

```
- 값 자체를 RGBA 채널에 인코딩한 WebP 타일로 서빙 (색을 굽지 않는다)
- 컬러맵 적용은 프래그먼트 셰이더에서 수행 → 컬러세이프 모드(§5.2.7) 전환이 즉시 가능
- 강수는 0 근처를 완전 투명 처리 (임계 0.1mm/h)
- 파도 레이어는 육지 마스크를 적용해 내륙에 색이 칠해지지 않게 한다
- 투명도: 강수 0.75 / 기온 0.55 / 파도 0.70 (지명 라벨이 읽혀야 함)
```

## 12.6 PoC 3종 (Phase 5 착수 전 필수 검증)
1. **PoC-1** 제주 지도 위 U/V 격자 기반 파티클이 60fps로 흐른다 (모바일 실기기 확인).
2. **PoC-2** 타임라인을 끌면 서로 다른 forecast 스텝이 **끊김 없이 보간**된다.
3. **PoC-3** 협재를 누르면 **날씨 + 물때 + CCTV** 가 하나의 바텀시트에 동시에 뜬다.

이 3개가 되면 나머지는 기능 확장 문제다.

---


# 13. CCTV 파이프라인 (G6, G12)

## 13.1 데이터 모델
```jsonc
// Firestore: cctv/{id}
{
  "id": "hyeopjae-01",
  "name": { "ko": "협재 해변 해수욕장", "en": "Hyeopjae Beach", "zhCN": "挟才海边", "zhTW": "挾才海邊", "ja": "挟才ビーチ" },
  "lat": 33.3941, "lng": 126.2396,
  "hlsUrl": "https://.../index.m3u8",
  "backupHlsUrl": null,
  "thumbnailUrl": "https://storage.../hyeopjae-01.jpg",
  "thumbnailUpdatedAt": "2026-09-22T09:40:00+09:00",
  "provider": "제주특별자치도",
  "attribution": "바름닷컴 × 제주특별자치도",
  "linkedSpotId": "hyeopjae",
  "tags": ["beach", "surf", "swim"],
  "status": "online",              // online | degraded | offline
  "healthCheck": { "lastOkAt": "...", "failCount": 0, "avgStartMs": 1850 },
  "enabled": true, "sortOrder": 10
}
```

## 13.2 재생 구현
```ts
// Safari / iOS: 네이티브 HLS
if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = url;
// 그 외: hls.js
else { const hls = new Hls({ lowLatencyMode: true, maxBufferLength: 10, liveSyncDurationCount: 3 });
       hls.loadSource(url); hls.attachMedia(video); }
```
- CORS 문제 시 `/api/cctv/proxy/[id]/*` 리버스 프록시 라우트를 둔다(단, 대역폭 비용 주의 — 기본은 직접 연결).
- 재생 시작 3초 초과 시 "연결이 느려요" 안내 + 백업 URL 시도.
- 에러 복구: `hls.js` 의 `NETWORK_ERROR` → `startLoad()` 재시도 2회, `MEDIA_ERROR` → `recoverMediaError()`.

## 13.3 재생 정책 (성능·비용)
```
- 화면 진입 시 자동재생 금지. 썸네일 + 재생 버튼 (§6.4)
- 동시 재생 스트림 최대 1개. 새 재생 시 이전 인스턴스 destroy()
- 화면 밖(IntersectionObserver ratio < 0.3) 3초 → 자동 일시정지
- 탭 비활성 → 즉시 일시정지
- 데이터 절약 설정 시 썸네일도 로드하지 않고 플레이스홀더 표시
- 기본 음소거(해변 CCTV는 대부분 무음이지만 브라우저 정책 대응)
```

## 13.4 헬스체크 & 자동 운영 (§10.4 연동)
```
Cloud Function (스케줄 5분):
  각 CCTV의 .m3u8 을 HEAD/GET → HTTP 200 + #EXTM3U 포함 + 세그먼트 시각이 5분 이내인지 확인
  성공 → failCount=0, status='online', lastOkAt 갱신
  실패 → failCount++ ; 1~2회: 'degraded' ; 3회 이상: 'offline' + 목록에서 자동 숨김 + 어드민 알림
  offline 상태가 복구되면 → 'online' + 구독자에게 복구 푸시 (§9.4 ③-E)
Cloud Run Job (스케줄 10분):
  ffmpeg 로 첫 프레임 캡처 → 640×360 WebP → Storage 업로드 → thumbnailUrl 갱신
  (캡처 실패는 헬스체크 실패와 동일 취급)
```

## 13.5 법적 고려 (§21 연계)
- CCTV 영상은 제공 기관의 자산이다. **재배포 권한을 반드시 확인**하고, 확인 전까지는 `제공기관 페이지로 이동` 방식(임베드 또는 링크)으로 처리한다.
- 모든 CCTV 카드에 **출처 표기(attribution) 필수**.
- 개인 식별이 가능한 근접 영상은 취급하지 않는다(해변 원경만).

---

