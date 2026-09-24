# Environment values

`.env.local` is ignored by Git. Never put KMA, KHOA, Firebase Admin, HLS credentials, or storage credentials in a `NEXT_PUBLIC_` variable.

## Already configured locally

| Variable | Type | Purpose |
|---|---|---|
| `APP_ENV` | `local` | Local runtime mode |
| `NEXT_PUBLIC_SITE_URL` | URL | Local canonical URL |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | boolean string | Select real Firebase or emulator |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Web identifiers | Browser Auth/Firestore/Storage connection |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Server/client project consistency check |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Base64 JSON | Firebase Admin server credential |

## User-issued values still needed

| Variable | Where to issue | Required format | Behavior when empty |
|---|---|---|---|
| `KMA_SERVICE_KEY` | Public Data Portal, KMA Short-term Forecast API | General authentication key, **Decoding** value | Weather uses Open-Meteo |
| `KHOA_SERVICE_KEY` | Public Data Portal, KHOA Tide Prediction API | General authentication key, **Decoding** value | Tides use the labelled reference model |

Restart `npm run dev` after changing either key. These keys are read only by Node.js BFF routes.

## Values that are not environment variables

CCTV records belong in Firestore collection `cctv`. Each record contains its HLS URL, provider page, attribution, health state, and `rightsVerified`. Until redistribution rights are confirmed, keep `playbackMode: external` and omit `hlsUrl`.

The Phase 5 renderer reads live NOAA GFS/GFS Wave frames from `data/grid` after `workers/grib-ingest/ingest_gfs.py` runs. When no valid local run exists, it falls back to the visibly labelled `BARUM_POC` field. Scheduled production refresh still needs an object-store target and Cloud Run Job identity; no unused storage secret is requested yet.

KMA typhoon tracks use the separate KMA API Hub `authKey`, not the Public Data Portal key above. Add a dedicated server-only variable only when the typhoon adapter is implemented; do not reuse or expose `KMA_SERVICE_KEY` in the browser.
