# Phase 4 handoff — CCTV

## Delivered

- Firestore-backed CCTV registry with a 10-camera Jeju fallback registry and five-locale names.
- Rights gate: records without verified redistribution rights stay in `external` mode and open the provider page. HLS is accepted only when `rightsVerified` and `hlsUrl` are both present.
- Native HLS on Safari/iOS and `hls.js` elsewhere, with two network/media recovery attempts, slow-start and failure states.
- Maximum one active stream, immediate pause on hidden tabs, and pause after three seconds below 30% viewport intersection.
- CCTV hub list/map views, combined weather/tide context, and `/[locale]/cctv/[id]` detail views.
- Health transition logic: failures 1–2 are degraded; failure 3 is offline and disabled; recovery resets status.
- Five-minute Function boundary and ten-minute thumbnail worker contract. No worker was deployed.

## DoD

- [ ] Ten Jeju cameras are registered and visible in list/map/detail; playback remains provider-link mode until redistribution rights and real HLS URLs are supplied.
- [ ] Real iOS Safari, Android Chrome, desktop Chrome and Safari playback validation requires an authorized stream.
- [x] Three failures hide a dead stream through shared health state logic, covered by unit tests.
- [x] The player enforces one stream and viewport/tab pause policies.
- [x] Every registry card and player displays attribution.

## Evidence

- `tests/unit/cctv.test.ts`: health and manifest rights checks.
- Production build includes CCTV list API, detail API, hub, and dynamic detail route.
- 10 registry records currently use `playbackMode: external`; this is intentional legal behavior, not a mock live stream.
