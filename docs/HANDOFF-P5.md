# Phase 5 handoff — weather map layers

## 2026-09-29 지도 UX·성능 업데이트

최신 사용자 지시는 [MAP-UX.md](MAP-UX.md)를 따른다. Windy.com에 가까운 지도 중심 화면으로 정리하고, 기상청 초단기예보·CCTV를 지도에서 열 수 있게 했다. 이동 중 CPU 화면 재계산을 MapLibre ImageSource로 교체했고, 격자 LRU 캐시와 정지 상태 입자 제한을 적용했다. 기상청 키가 있는 한국 지점의 시간별 자료는 초단기예보를 우선하고 실제 출처·발표 시각을 화면에 표시한다. 키가 없으면 Open-Meteo라고 명시한다.

로컬 프로덕션 빌드, 단위 테스트 76개, 지도 E2E 12개, 다크·라이트 접근성 및 번들 예산 검증을 통과했다. Chrome 1280×720의 대기·이동 측정은 각각 60fps였고, 3840×2160에서 입자 Canvas 300만 픽셀 상한을 확인했다. 강수 실데이터가 없을 때 합성 강수장을 숨기고 자료 부재를 표시한다. 안드로이드 중급 기기와 4K PC 프레임 속도 실측, 라이브 격자 수집·배포, 공식 KMA 키 연동은 남아 있다.

## Delivered

- A strict grid contract for the Barum East Asia window (`108–148E`, `18–48N`) at 0.25° (`161×121`), covering Hong Kong, eastern China, Taiwan, the Korean Peninsula, and Japan. Point weather stays on the point BFF and is never used to build map fields.
- `/api/v1/grid/[variable]` for wind, rain, temperature, and waves with source/run/valid time metadata.
- A directly implemented, map-synchronized Canvas renderer over MapLibre; no third-party weather layer and no GPL code.
- Viewport-scoped animated wind vectors, interpolated scalar fields, bilinear spatial sampling, adjacent-step temporal interpolation, and four layer controls.
- Timeline playback through +120h with a shareable `at` URL parameter.
- Viewport-scoped particle density: 360 on mobile and 720 on larger screens, with animation disabled for reduced-motion and data-saver users.
- Reduced-motion/data-saver static wind field and hidden-tab render suspension.
- NOAA NOMADS GFS/GFS Wave GRIB2 ingest worker, Dockerfile, normalized local manifest reader, and Float16 encoder under `workers/grib-ingest/`.
- ECMWF IFS and DWD ICON official open-data workers, model-specific manifests, API model selection, and an on-map `ECMWF / GFS / ICON` selector. Model feeds use one normalized grid contract; selected-model wave gaps explicitly fall back to the labelled NOAA GFS Wave run.

## Data status

When `data/grid/latest.json` exists, the visible field uses the latest downloaded NOAA GFS 0.25° atmosphere and wave run for +0h through +120h. The UI shows the GFS source on the map. If the local run is absent or invalid, the API falls back to `BARUM_POC` and labels it as a renderer-validation field. Immutable object upload and scheduled Cloud Run execution still require deployment configuration.

Typhoon forecast tracks are a separate point/track feed and are not inferred from the GFS grid. The KMA API Hub track adapter and map track UI are still outstanding; they require a valid `KMA_SERVICE_KEY` and are not part of the Phase 5 DoD in `docs/7-roadmap.md`.

## DoD

- [ ] The particle path is implemented, but ≥50fps must be measured on a real mid-range Android device after live binary delivery is configured.
- [x] Timeline changes interpolate adjacent 3-hour GFS frames without replacing the map.
- [x] Wind/rain/temperature/wave share one small grid API, use NOAA GFS when available, and switch in place.
- [x] Particle count adapts and reduced-motion/data-saver modes avoid animated particles.
- [x] License review: direct implementation, MapLibre (BSD-3-Clause), no GPL weather-layer package.

## Evidence

- `tests/unit/grid.test.ts`: grid dimensions, interpolation, sampling, and adaptive density.
- `workers/grib-ingest/encode.mjs`: finite-grid validation and little-endian Float16 output.
- `workers/grib-ingest/ingest_gfs.py`: live NOAA subset download, GRIB2 decoding, normalization, land masking, and +120h manifest generation.
- Production build exposes the grid API and all localized map routes.
