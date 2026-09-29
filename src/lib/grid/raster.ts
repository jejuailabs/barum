import type {GridFrame, GridVariable} from '@/types/domain';
import {sampleGrid} from './interpolate';

export const rampStops: Record<GridVariable, number[]> = {
  wind: [0, 2.5, 5, 8, 10, 15, 20, 25, 31, 40],
  rain: [.08, .3, 1, 2, 5, 10, 20, 40],
  temp: [-30, -20, -10, 0, 10, 20, 30, 45],
  wave: [.05, .5, 1, 1.5, 2, 3.5, 6, 9]
};

export function mercatorY(lat: number) {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}

export function latitudeAt(north: number, south: number, fraction: number) {
  const y = mercatorY(north) + (mercatorY(south) - mercatorY(north)) * fraction;
  return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
}

// Project once per forecast frame. The GPU handles all viewport changes.
export function rasterizeGrid(frame: GridFrame, colors: string[]) {
  const width = Math.min(768, frame.width * 2);
  const height = Math.min(768, frame.height * 2);
  const data = new Uint8ClampedArray(width * height * 4);
  const ramp = colors.map(color => [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16)));
  const stops = rampStops[frame.variable];
  const {west, east, north, south} = frame.bounds;
  for (let y = 0; y < height; y++) {
    const lat = latitudeAt(north, south, y / (height - 1));
    for (let x = 0; x < width; x++) {
      const lng = west + (east - west) * x / (width - 1);
      const value = sampleGrid(frame, lng, lat);
      if (!Number.isFinite(value)) continue;
      const upper = stops.findIndex(stop => value < stop);
      const to = upper < 0 ? stops.length - 1 : Math.max(1, upper);
      const from = to - 1;
      const mix = Math.max(0, Math.min(1, (value - stops[from]) / (stops[to] - stops[from])));
      const edge = Math.min(1, (lng - west) / 1.5, (east - lng) / 1.5, (north - lat) / 1.2, (lat - south) / 1.2);
      let alpha = .78;
      if (frame.variable === 'rain') alpha = Math.min(.85, Math.max(0, (value - .02) / .3));
      if (frame.variable === 'wave') alpha = value < .05 ? 0 : .8;
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) data[offset + channel] = ramp[from][channel] + (ramp[to][channel] - ramp[from][channel]) * mix;
      data[offset + 3] = Math.round(255 * alpha * edge * edge * (3 - 2 * edge));
    }
  }
  return {width, height, data};
}
