#!/usr/bin/env python3
"""Ingest DWD ICON global open-data fields and regrid them to Barum's grid."""

from __future__ import annotations

import argparse
import bz2
import json
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

from grid_common import HEIGHT, WIDTH, empty_manifest, make_frame, parse_steps, publish_manifest, read_values, write_frame

BASE_URL = "https://opendata.dwd.de/weather/nwp/icon/grib"
FIELDS = {"u": ("u_10m", "U_10M"), "v": ("v_10m", "V_10M"), "temp": ("t_2m", "T_2M"), "rain": ("tot_prec", "TOT_PREC")}


def candidate_runs(now: datetime) -> list[datetime]:
    cursor = now.astimezone(timezone.utc) - timedelta(hours=6)
    cursor = cursor.replace(hour=(cursor.hour // 6) * 6, minute=0, second=0, microsecond=0)
    return [cursor - timedelta(hours=6 * index) for index in range(12)]


def field_url(run: datetime, step: int, field: str) -> str:
    directory, suffix = FIELDS[field]
    filename = f"icon_global_icosahedral_single-level_{run:%Y%m%d%H}_{step:03d}_{suffix}.grib2.bz2"
    return f"{BASE_URL}/{run:%H}/{directory}/{filename}"


def fetch_field(run: datetime, step: int, field: str) -> list[float]:
    request = urllib.request.Request(field_url(run, step, field), headers={"User-Agent": "barum-grid-ingest/0.2"})
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = bz2.decompress(response.read())
    return read_values(payload)


class Regridder:
    def __init__(self):
        mapping_path = Path(__file__).with_name("icon_east_asia_source_indices.json")
        self.source_indices = json.loads(mapping_path.read_text(encoding="utf-8"))
        if len(self.source_indices) != WIDTH * HEIGHT:
            raise RuntimeError("ICON East Asia remap table has the wrong size")

    def apply(self, values: list[float]) -> list[float]:
        if max(self.source_indices) >= len(values):
            raise RuntimeError("ICON field is incompatible with the DWD R03B07 remap table")
        return [values[index] for index in self.source_indices]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=parse_steps, default=parse_steps("0,3,6,9,12"))
    parser.add_argument("--output", type=Path, default=Path("data/grid/icon"))
    args = parser.parse_args()

    run = None
    first_raw = None
    for candidate in candidate_runs(datetime.now(timezone.utc)):
        try:
            first_raw = fetch_field(candidate, args.steps[0], "u")
            run = candidate
            break
        except Exception as error:
            print(f"skip ICON {candidate.isoformat()}: {error}")
    if run is None or first_raw is None:
        raise RuntimeError("No recent DWD ICON run was available")

    regridder = Regridder()
    manifest = empty_manifest("ICON", run, args.steps)
    previous_precipitation: list[float] | None = None
    previous_step = 0
    for index, step in enumerate(args.steps):
        fields: dict[str, list[float]] = {}
        remaining = [field for field in FIELDS if not (index == 0 and field == "u")]
        with ThreadPoolExecutor(max_workers=2) as executor:
            downloaded = dict(zip(remaining, executor.map(lambda field: fetch_field(run, step, field), remaining)))
        for field in FIELDS:
            raw_values = first_raw if index == 0 and field == "u" else downloaded[field]
            fields[field] = regridder.apply(raw_values)

        hours = max(1, step - previous_step)
        precipitation = fields["rain"]
        rain_rate = [0.0] * len(precipitation) if previous_precipitation is None else [max(0.0, (current - previous) / hours) for current, previous in zip(precipitation, previous_precipitation)]
        previous_precipitation = precipitation
        previous_step = step
        u, v = fields["u"], fields["v"]
        frames = {
            "wind": make_frame("ICON", run, step, "wind", [math.hypot(east, north) for east, north in zip(u, v)], "sources.iconGrid", u=u, v=v),
            "rain": make_frame("ICON", run, step, "rain", rain_rate, "sources.iconGrid"),
            "temp": make_frame("ICON", run, step, "temp", [value - 273.15 for value in fields["temp"]], "sources.iconGrid"),
        }
        for variable, contents in frames.items():
            manifest["frames"][variable][str(step)] = write_frame(args.output, run, step, variable, contents)
        print(f"ICON {run:%Y-%m-%d %HZ} +{step:03d} written")
    publish_manifest(args.output, manifest)


if __name__ == "__main__":
    main()
