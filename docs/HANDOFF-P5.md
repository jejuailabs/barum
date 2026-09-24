# Phase 5 handoff — weather map layers

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
