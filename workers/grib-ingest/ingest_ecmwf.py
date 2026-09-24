#!/usr/bin/env python3
"""Ingest the ECMWF IFS open-data fields used by the Barum map."""

from __future__ import annotations

import argparse
import json
import math
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

from grid_common import empty_manifest, make_frame, normalize_regular, parse_steps, publish_manifest, read_messages, write_frame

BASE_URL = "https://data.ecmwf.int/forecasts"
PARAMETERS = {"10u": "u", "10v": "v", "2t": "temp", "tprate": "rain"}


def candidate_runs(now: datetime) -> list[datetime]:
    cursor = now.astimezone(timezone.utc) - timedelta(hours=6)
    cursor = cursor.replace(hour=(cursor.hour // 12) * 12, minute=0, second=0, microsecond=0)
    return [cursor - timedelta(hours=12 * index) for index in range(8)]


def file_urls(run: datetime, step: int) -> tuple[str, str]:
    stem = f"{run:%Y%m%d%H}0000-{step}h-oper-fc"
    directory = f"{BASE_URL}/{run:%Y%m%d}/{run:%H}z/ifs/0p25/oper"
    return f"{directory}/{stem}.grib2", f"{directory}/{stem}.index"


def fetch(url: str, *, byte_range: tuple[int, int] | None = None) -> bytes:
    headers = {"User-Agent": "barum-grid-ingest/0.2"}
    if byte_range:
        headers["Range"] = f"bytes={byte_range[0]}-{byte_range[1]}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response:
        return response.read()


def fetch_step(run: datetime, step: int) -> dict[str, list[float]]:
    grib_url, index_url = file_urls(run, step)
    records = [json.loads(line) for line in fetch(index_url).decode("utf-8").splitlines() if line.strip()]
    selected = {record["param"]: record for record in records if record.get("param") in PARAMETERS and record.get("levtype") == "sfc"}
    missing = PARAMETERS.keys() - selected.keys()
    if missing:
        raise RuntimeError(f"ECMWF index fields missing: {', '.join(sorted(missing))}")
    ranges = [(record["_offset"], record["_offset"] + record["_length"] - 1) for record in selected.values()]
    with ThreadPoolExecutor(max_workers=4) as executor:
        payload = b"".join(executor.map(lambda byte_range: fetch(grib_url, byte_range=byte_range), ranges))
    fields: dict[str, list[float]] = {}
    for short_name, latitudes, longitudes, values in read_messages(payload):
        key = PARAMETERS.get(short_name)
        if key:
            fields[key] = normalize_regular(latitudes, longitudes, values)
    if set(fields) != set(PARAMETERS.values()):
        raise RuntimeError("ECMWF GRIB fields did not decode completely")
    return fields


def write_step(root: Path, run: datetime, step: int, fields: dict[str, list[float]]) -> dict[str, str]:
    u, v = fields["u"], fields["v"]
    frames = {
        "wind": make_frame("ECMWF", run, step, "wind", [math.hypot(east, north) for east, north in zip(u, v)], "sources.ecmwfGrid", u=u, v=v),
        "rain": make_frame("ECMWF", run, step, "rain", [max(0.0, value * 3600) for value in fields["rain"]], "sources.ecmwfGrid"),
        "temp": make_frame("ECMWF", run, step, "temp", [value - 273.15 for value in fields["temp"]], "sources.ecmwfGrid"),
    }
    return {variable: write_frame(root, run, step, variable, contents) for variable, contents in frames.items()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=parse_steps, default=parse_steps("0,3,6,9,12"))
    parser.add_argument("--output", type=Path, default=Path("data/grid/ecmwf"))
    args = parser.parse_args()

    run = None
    first_fields = None
    for candidate in candidate_runs(datetime.now(timezone.utc)):
        try:
            first_fields = fetch_step(candidate, args.steps[0])
            run = candidate
            break
        except Exception as error:
            print(f"skip ECMWF {candidate.isoformat()}: {error}")
    if run is None or first_fields is None:
        raise RuntimeError("No recent ECMWF open-data run was available")

    manifest = empty_manifest("ECMWF", run, args.steps)
    fields_by_step = {args.steps[0]: first_fields}
    with ThreadPoolExecutor(max_workers=3) as executor:
        pending = {executor.submit(fetch_step, run, step): step for step in args.steps[1:]}
        for future in as_completed(pending):
            step = pending[future]
            fields_by_step[step] = future.result()
            print(f"ECMWF {run:%Y-%m-%d %HZ} +{step:03d} downloaded")
    for step in args.steps:
        fields = fields_by_step[step]
        for variable, relative in write_step(args.output, run, step, fields).items():
            manifest["frames"][variable][str(step)] = relative
        print(f"ECMWF {run:%Y-%m-%d %HZ} +{step:03d} written")
    publish_manifest(args.output, manifest)


if __name__ == "__main__":
    main()
