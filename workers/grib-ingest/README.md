# GRIB ingest worker

This Cloud Run Job is the production boundary between model data and the web app.

1. Download the Barum East Asia window (`108–148E`, `18–48N`) from NOAA GFS, ECMWF IFS Open Data, or DWD ICON Open Data. It covers Hong Kong, coastal eastern China, Taiwan, the Korean Peninsula, and Japan.
2. Extract 10 m U/V wind, 2 m temperature, accumulated precipitation, and significant wave height.
3. Normalize each run to the `GridFrame` metadata contract and encode numeric arrays as little-endian Float16 binaries.
4. Write immutable objects under `/grid/{model}/{runISO}/{variable}/{stepHours}.bin` and a sibling metadata JSON file.
5. Publish a model-specific run manifest under `data/grid/{gfs|ecmwf|icon}/latest.json` only after every required step passes validation.

The web app never creates a grid by repeating point API calls. `ingest_gfs.py` downloads NOAA GFS atmosphere and GFS Wave subsets, decodes the 161×121 East Asia grid, normalizes wave missing values, and writes wind/rain/temperature/wave frames plus `latest.json`.

Local refresh:

```powershell
$env:PYTHONPATH = (Resolve-Path '.tools\grib').Path
$steps = ((0..40 | ForEach-Object { $_ * 3 }) -join ',')
python workers\grib-ingest\ingest_gfs.py --steps $steps
python workers\grib-ingest\ingest_ecmwf.py --steps $steps
python workers\grib-ingest\ingest_icon.py --steps $steps
```

These feeds require no API keys. ECMWF uses its JSON line index and HTTP byte ranges so only 10 m wind, 2 m temperature, and precipitation-rate messages are transferred. ICON downloads DWD's variable-specific bzip2 files and uses the checked-in East Asia subset of DWD's official `ICON_GLOBAL2WORLD_025_EASY` remap table to transform the native R03B07 mesh to the shared 0.25° contract. Atmospheric model selection is available in the UI; wave data stays on the independently published NOAA GFS Wave run until a model-specific wave product is ingested.

The generated `data/grid/**/*.json` files stay out of Git. `/api/v1/grid/[variable]?model=GFS|ECMWF|ICON` reads the selected model when present and falls back to visibly labelled renderer preview data when a run is unavailable. The included Dockerfile is the Cloud Run Job boundary; object storage upload and scheduling remain deployment configuration.
