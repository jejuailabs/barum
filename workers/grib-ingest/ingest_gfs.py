#!/usr/bin/env python3
"""Download the Barum East Asia NOAA GFS subset and write GridFrame JSON.

The script is intentionally a build/worker tool. The web application never calls
point forecast APIs to paint a grid. Production can upload the generated run
directory and latest.json manifest to object storage without changing the API.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from eccodes import (
    codes_get,
    codes_get_array,
    codes_get_values,
    codes_grib_new_from_file,
    codes_release,
)

BOUNDS = {"west": 108.0, "south": 18.0, "east": 148.0, "north": 48.0}
GRID_STEP = 0.25
WIDTH = round((BOUNDS["east"] - BOUNDS["west"]) / GRID_STEP) + 1
HEIGHT = round((BOUNDS["north"] - BOUNDS["south"]) / GRID_STEP) + 1
FILTER_URL = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl"
WAVE_FILTER_URL = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl"


def candidate_runs(now: datetime) -> list[datetime]:
    cursor = now.astimezone(timezone.utc) - timedelta(hours=5)
    cursor = cursor.replace(hour=(cursor.hour // 6) * 6, minute=0, second=0, microsecond=0)
    return [cursor - timedelta(hours=6 * index) for index in range(8)]


def subset_url(run: datetime, step: int) -> str:
    query = {
        "file": f"gfs.t{run:%H}z.pgrb2.0p25.f{step:03d}",
        "lev_10_m_above_ground": "on",
        "lev_2_m_above_ground": "on",
        "lev_surface": "on",
        "var_UGRD": "on",
        "var_VGRD": "on",
        "var_TMP": "on",
        "var_PRATE": "on",
        "subregion": "",
        "leftlon": str(BOUNDS["west"]),
        "rightlon": str(BOUNDS["east"]),
        "toplat": str(BOUNDS["north"]),
        "bottomlat": str(BOUNDS["south"]),
        "dir": f"/gfs.{run:%Y%m%d}/{run:%H}/atmos",
    }
    return f"{FILTER_URL}?{urllib.parse.urlencode(query)}"


def wave_subset_url(run: datetime, step: int) -> str:
    query = {
        "file": f"gfswave.t{run:%H}z.global.0p25.f{step:03d}.grib2",
        "lev_surface": "on",
        "var_HTSGW": "on",
        "subregion": "",
        "leftlon": str(BOUNDS["west"]),
        "rightlon": str(BOUNDS["east"] + 0.25),
        "toplat": str(BOUNDS["north"]),
        "bottomlat": str(BOUNDS["south"]),
        "dir": f"/gfs.{run:%Y%m%d}/{run:%H}/wave/gridded",
    }
    return f"{WAVE_FILTER_URL}?{urllib.parse.urlencode(query)}"


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "barum-grid-ingest/0.1"})
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = response.read()
    if not payload.startswith(b"GRIB"):
        raise RuntimeError(f"NOMADS did not return GRIB2 ({len(payload)} bytes)")
    return payload


def message_key(handle: int) -> str | None:
    short_name = str(codes_get(handle, "shortName")).lower()
    level = int(codes_get(handle, "level"))
    if short_name in {"10u", "u10"} or (short_name == "u" and level == 10):
        return "u"
    if short_name in {"10v", "v10"} or (short_name == "v" and level == 10):
        return "v"
    if short_name in {"2t", "t2m"} or (short_name == "t" and level == 2):
        return "temp"
    if short_name in {"prate", "avg_prate"}:
        return "rain"
    return None


def normalize_field(latitudes: list[float], longitudes: list[float], values: list[float]) -> list[float]:
    points = {(round(lat, 4), round(lon % 360, 4)): float(value) for lat, lon, value in zip(latitudes, longitudes, values)}
    result: list[float] = []
    for row in range(HEIGHT):
        lat = round(BOUNDS["north"] - row * GRID_STEP, 4)
        for column in range(WIDTH):
            lon = round(BOUNDS["west"] + column * GRID_STEP, 4)
            try:
                result.append(points[(lat, lon)])
            except KeyError as error:
                raise RuntimeError(f"Missing GFS point {lat},{lon}") from error
    return result


def decode(payload: bytes) -> dict[str, list[float]]:
    decoded: dict[str, list[float]] = {}
    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=False) as temporary:
        temporary.write(payload)
        temporary_path = temporary.name
    try:
        with open(temporary_path, "rb") as stream:
            while True:
                handle = codes_grib_new_from_file(stream)
                if handle is None:
                    break
                try:
                    key = message_key(handle)
                    if key is None or key in decoded:
                        continue
                    decoded[key] = normalize_field(
                        [float(value) for value in codes_get_array(handle, "latitudes")],
                        [float(value) for value in codes_get_array(handle, "longitudes")],
                        [float(value) for value in codes_get_values(handle)],
                    )
                finally:
                    codes_release(handle)
    finally:
        try:
            os.unlink(temporary_path)
        except PermissionError:
            # ecCodes can retain a Windows file mapping until process shutdown.
            pass
    missing = {"u", "v", "temp", "rain"} - decoded.keys()
    if missing:
        raise RuntimeError(f"GFS fields missing from subset: {', '.join(sorted(missing))}")
    return decoded


def decode_wave(payload: bytes) -> list[float]:
    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=False) as temporary:
        temporary.write(payload)
        temporary_path = temporary.name
    try:
        with open(temporary_path, "rb") as stream:
            handle = codes_grib_new_from_file(stream)
            if handle is None or str(codes_get(handle, "shortName")).lower() not in {"swh", "htsgw"}:
                raise RuntimeError("GFS Wave significant-height field missing")
            try:
                values = normalize_field(
                    [float(value) for value in codes_get_array(handle, "latitudes")],
                    [float(value) for value in codes_get_array(handle, "longitudes")],
                    [float(value) for value in codes_get_values(handle)],
                )
                return [0.0 if value >= 9990 else max(0.0, value) for value in values]
            finally:
                codes_release(handle)
    finally:
        try:
            os.unlink(temporary_path)
        except PermissionError:
            pass


def frame(run: datetime, step: int, variable: str, values: list[float], *, u: list[float] | None = None, v: list[float] | None = None) -> dict:
    result = {
        "model": "GFS",
        "runAt": run.isoformat().replace("+00:00", "Z"),
        "validAt": (run + timedelta(hours=step)).isoformat().replace("+00:00", "Z"),
        "variable": variable,
        "bounds": BOUNDS,
        "width": WIDTH,
        "height": HEIGHT,
        "values": values,
        "units": "m/s" if variable == "wind" else "mm/h" if variable == "rain" else "m" if variable == "wave" else "°C",
        "sourceLabelKey": "sources.gfsGrid",
        "preview": False,
    }
    if u is not None:
        result["u"] = u
    if v is not None:
        result["v"] = v
    return result


def write_step(root: Path, run: datetime, step: int, fields: dict[str, list[float]]) -> dict[str, str]:
    u = fields["u"]
    v = fields["v"]
    frames = {
        "wind": frame(run, step, "wind", [math.hypot(east, north) for east, north in zip(u, v)], u=u, v=v),
        "rain": frame(run, step, "rain", [max(0.0, value * 3600) for value in fields["rain"]]),
        "temp": frame(run, step, "temp", [value - 273.15 for value in fields["temp"]]),
    }
    relative: dict[str, str] = {}
    run_id = run.strftime("%Y%m%dT%H00Z")
    for variable, contents in frames.items():
        path = root / run_id / variable / f"{step}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(contents, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        relative[variable] = path.relative_to(root).as_posix()
    return relative


def write_wave_step(root: Path, run: datetime, step: int, values: list[float]) -> str:
    run_id = run.strftime("%Y%m%dT%H00Z")
    path = root / run_id / "wave" / f"{step}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(frame(run, step, "wave", values), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path.relative_to(root).as_posix()


def parse_steps(value: str) -> list[int]:
    result = sorted({int(part) for part in value.split(",") if part.strip()})
    if not result or any(step < 0 or step > 360 for step in result):
        raise argparse.ArgumentTypeError("steps must be comma-separated forecast hours from 0 to 360")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=parse_steps, default=parse_steps("0,3,6,9,12"))
    parser.add_argument("--output", type=Path, default=Path("data/grid/gfs"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    run: datetime | None = None
    first_payload: bytes | None = None
    for candidate in candidate_runs(datetime.now(timezone.utc)):
        try:
            first_payload = download(subset_url(candidate, args.steps[0]))
            run = candidate
            break
        except Exception as error:
            print(f"skip {candidate.isoformat()}: {error}")
    if run is None or first_payload is None:
        raise RuntimeError("No recent NOAA GFS run was available")

    wave_run: datetime | None = None
    first_wave_payload: bytes | None = None
    for candidate in candidate_runs(datetime.now(timezone.utc) - timedelta(hours=3)):
        try:
            first_wave_payload = download(wave_subset_url(candidate, args.steps[0]))
            wave_run = candidate
            break
        except Exception as error:
            print(f"skip wave {candidate.isoformat()}: {error}")

    manifest = {
        "model": "GFS",
        "runAt": run.isoformat().replace("+00:00", "Z"),
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "bounds": BOUNDS,
        "steps": args.steps,
        "frames": {"wind": {}, "rain": {}, "temp": {}, "wave": {}},
    }
    for index, step in enumerate(args.steps):
        payload = first_payload if index == 0 else download(subset_url(run, step))
        relative = write_step(args.output, run, step, decode(payload))
        for variable, path in relative.items():
            manifest["frames"][variable][str(step)] = path
        if wave_run is not None and first_wave_payload is not None:
            wave_payload = first_wave_payload if index == 0 else download(wave_subset_url(wave_run, step))
            manifest["frames"]["wave"][str(step)] = write_wave_step(args.output, wave_run, step, decode_wave(wave_payload))
        print(f"GFS {run:%Y-%m-%d %HZ} +{step:03d} written")
    (args.output / "latest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
