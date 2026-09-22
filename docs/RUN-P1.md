# Sol 실행 지시 — Phase 1

**선행 조건: HANDOFF-P0.md의 Phase 0 DoD가 전부 체크되어 있어야 한다. Preview 배포는 사용자가 GitHub 자동 연결로 관리한다. 별도 요청 없이 Vercel을 조작하거나 배포 승인을 요청하지 않는다. 배포 완료 여부는 사용자가 제공한 결과로 확인한다.**

사용자는 Phase 0까지 Astra, 이후 일반 구현은 Sol로 진행하기로 했다. 같은 작업과 저장소를 이어 사용한다.

## 읽을 문서

AGENTS.md, 00-INDEX.md, HANDOFF-P0.md, DECISIONS.md, `_ia.md`, `2-design.md`, `4-data.md` §11.2, `7-roadmap.md` Phase 1 및 §23.2. `images/`의 시안 4개를 직접 확인한다. 나머지 스펙 전체를 다시 읽지 않는다.

## 순서

1. 실제 데이터 계약: `NormalizedPoint`, `NormalizedMarine`, `NormalizedTide`, `SourceMeta`, `AdviceResult`, 오류/부분 결측 상태를 정의한다. 종합 응답의 날씨·해양·물때 출처를 개별 유지한다. 번역 문장은 키와 파라미터로 전달한다.
2. 목업 어댑터: `src/lib/sources/` 내부에만 둔다. UI가 픽스처나 외부 기관 응답 타입을 직접 import하지 않도록 한다.
3. 하단 물때/CCTV/중앙 지도/여행/더보기 5탭과 지도 중심 레이아웃. 지도 베이스 공급자의 사용 조건과 라이선스를 먼저 확인하며, 새 유료 API는 사용자 확인 대상이다.
4. BottomSheet, LayerRail, SegmentedTabs, MetricCell, CurrentWeatherCard, HourlyStrip, TideChart, TideStrip, CctvCard, AdviceCard, RecommendCard, TimelineSlider, ConfidenceBadge, SafetyBanner를 명세와 매핑한다.
5. 화면 A~E를 구성한다. 지도 팬/줌을 막지 않는 드래그 가능한 바텀시트를 사용한다. 현 시점의 홈 기반 안내는 지도 홈으로 대체하고 `/dev/gallery`는 유지한다.
6. 5개 언어·모바일/태블릿/데스크톱·다크/라이트를 검증한다. 번역 동적 키가 추가되면 i18n 검사기의 명시적인 동적 사용 목록을 함께 관리한다.
7. 모든 품질 게이트와 Phase 1 DoD를 출력하고 HANDOFF-P1.md에 결과·남은 문제를 남긴다.

## 완료 조건

- 시안 4장의 구조·간격·위계 및 §23.2 매핑 체크리스트 전체 충족.
- 바텀시트가 열린 상태에서 지도 팬/줌 가능.
- 모바일/태블릿/데스크톱에서 깨짐 없음.
- 주요 5화면 × 2테마 스크린샷 10장.
- axe-core 위반 0건.
- `typecheck`, `lint`, `test`, `i18n:check`, `build`, `analyze`, 관련 E2E 통과.

지도 전체 실데이터 격자·파티클 파이프라인은 Phase 5다. 지점 API 반복 호출로 대체하지 않는다. 안전 문구의 외국어 전문 감수가 필요한 경우 미감수 문구를 승인된 안전 안내로 표시하지 않는다.
