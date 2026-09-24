"""Shared normalization and manifest helpers for Barum grid workers."""

from __future__ import annotations

import json
import math
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from eccodes import codes_get, codes_get_array, codes_get_values, codes_grib_new_from_file, codes_release

BOUNDS = {"west": 108.0, "south": 18.0, "east": 148.0, "north": 48.0}
GRID_STEP = 0.25
WIDTH = round((BOUNDS["east"] - BOUNDS["west"]) / GRID_STEP) + 1
HEIGHT = round((BOUNDS["north"] - BOUNDS["south"]) / GRID_STEP) + 1
VARIABLES = ("wind", "rain", "temp", "wave")


def parse_steps(value: str) -> list[int]:
    result = sorted({int(part) for part in value.split(",") if part.strip()})
    if not result or any(step < 0 or step > 360 for step in result):
        raise ValueError("steps must be comma-separated forecast hours from 0 to 360")
    return result


def normalize_regular(latitudes: list[float], longitudes: list[float], values: list[float]) -> list[float]:
    points = {(round(lat, 4), round(lon % 360, 4)): float(value) for lat, lon, value in zip(latitudes, longitudes, values)}
    result: list[float] = []
    for row in range(HEIGHT):
        lat = round(BOUNDS["north"] - row * GRID_STEP, 4)
        for column in range(WIDTH):
            lon = round(BOUNDS["west"] + column * GRID_STEP, 4)
            try:
                result.append(points[(lat, lon)])
            except KeyError as error:
                raise RuntimeError(f"Missing regular-grid point {lat},{lon}") from error
    return result


def read_messages(payload: bytes) -> list[tuple[str, list[float], list[float], list[float]]]:
    messages: list[tuple[str, list[float], list[float], list[float]]] = []
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
                    messages.append((
                        str(codes_get(handle, "shortName")).lower(),
                        [float(value) for value in codes_get_array(handle, "latitudes")],
                        [float(value) for value in codes_get_array(handle, "longitudes")],
                        [float(value) for value in codes_get_values(handle)],
                    ))
                finally:
                    codes_release(handle)
    finally:
        try:
            os.unlink(temporary_path)
        except PermissionError:
            pass
    return messages


def read_values(payload: bytes) -> list[float]:
    """Read a single GRIB field whose native unstructured grid has no coordinates."""
    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=False) as temporary:
        temporary.write(payload)
        temporary_path = temporary.name
    try:
        with open(temporary_path, "rb") as stream:
            handle = codes_grib_new_from_file(stream)
            if handle is None:
                raise RuntimeError("GRIB field was empty")
            try:
                values = [float(value) for value in codes_get_values(handle)]
                extra = codes_grib_new_from_file(stream)
                if extra is not None:
                    codes_release(extra)
                    raise RuntimeError("Expected one GRIB message")
                return values
            finally:
                codes_release(handle)
    finally:
        try:
            os.unlink(temporary_path)
        except PermissionError:
            pass


def cleaned(values: list[float], *, minimum: float | None = None) -> list[float]:
    result = []
    for value in values:
        if not math.isfinite(value) or abs(value) >= 9_000:
            value = 0.0
        if minimum is not None:
            value = max(minimum, value)
        result.append(round(value, 3))
    return result


def make_frame(model: str, run: datetime, step: int, variable: str, values: list[float], source_label_key: str, *, u: list[float] | None = None, v: list[float] | None = None) -> dict:
    result = {
        "model": model,
        "runAt": run.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "validAt": (run + timedelta(hours=step)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "variable": variable,
        "bounds": BOUNDS,
        "width": WIDTH,
        "height": HEIGHT,
        "values": cleaned(values, minimum=0.0 if variable in {"rain", "wave"} else None),
        "units": "m/s" if variable == "wind" else "mm/h" if variable == "rain" else "m" if variable == "wave" else "°C",
        "sourceLabelKey": source_label_key,
        "preview": False,
    }
    if u is not None:
        result["u"] = cleaned(u)
    if v is not None:
        result["v"] = cleaned(v)
    return result


def empty_manifest(model: str, run: datetime, steps: list[int]) -> dict:
    return {
        "model": model,
        "runAt": run.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "bounds": BOUNDS,
        "steps": steps,
        "frames": {variable: {} for variable in VARIABLES},
    }


def write_frame(root: Path, run: datetime, step: int, variable: str, contents: dict) -> str:
    run_id = run.strftime("%Y%m%dT%H00Z")
    path = root / run_id / variable / f"{step}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(contents, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return path.relative_to(root).as_posix()


def publish_manifest(root: Path, manifest: dict) -> None:
    root.mkdir(parents=True, exist_ok=True)
    temporary = root / "latest.json.tmp"
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(root / "latest.json")
