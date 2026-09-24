import type {GridFrame} from '@/types/domain';

export function lerp(a: number, b: number, fraction: number) {
  return a + (b - a) * Math.min(1, Math.max(0, fraction));
}

export function interpolateFrames(a: GridFrame, b: GridFrame, fraction: number): GridFrame {
  if (a.variable !== b.variable || a.width !== b.width || a.height !== b.height) throw new Error('Incompatible grid frames');
  return {...a, validAt: fraction < .5 ? a.validAt : b.validAt,
    values: a.values.map((value, index) => lerp(value, b.values[index], fraction)),
    u: a.u?.map((value, index) => lerp(value, b.u?.[index] ?? value, fraction)),
    v: a.v?.map((value, index) => lerp(value, b.v?.[index] ?? value, fraction))};
}

export function sampleGrid(frame: GridFrame, lng: number, lat: number, field: 'values' | 'u' | 'v' = 'values') {
  const values = frame[field];
  if (!values) return 0;
  const x = Math.min(frame.width - 1, Math.max(0, (lng - frame.bounds.west) / (frame.bounds.east - frame.bounds.west) * (frame.width - 1)));
  const y = Math.min(frame.height - 1, Math.max(0, (frame.bounds.north - lat) / (frame.bounds.north - frame.bounds.south) * (frame.height - 1)));
  const x0 = Math.floor(x), x1 = Math.min(frame.width - 1, x0 + 1), y0 = Math.floor(y), y1 = Math.min(frame.height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const top = lerp(values[y0 * frame.width + x0], values[y0 * frame.width + x1], fx);
  const bottom = lerp(values[y1 * frame.width + x0], values[y1 * frame.width + x1], fx);
  return lerp(top, bottom, fy);
}

export function initialParticleCount(width: number, reducedMotion = false, saveData = false) {
  if (reducedMotion || saveData) return 0;
  if (width < 768) return 4_000;
  if (width < 1280) return 8_000;
  return 16_000;
}

export function adaptParticleCount(count: number, fps: number) {
  if (fps < 45) return Math.max(1_500, Math.floor(count * .75));
  if (fps > 57) return Math.min(30_000, Math.ceil(count * 1.15));
  return count;
}
