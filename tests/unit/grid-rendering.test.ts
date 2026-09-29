import {describe, expect, it, vi} from 'vitest';
import {createFrameCache, forecastSteps} from '@/lib/grid/frameCache';
import {latitudeAt, rasterizeGrid} from '@/lib/grid/raster';
import {interpolateFrames} from '@/lib/grid/interpolate';
import {createPreviewGrid} from '@/lib/sources/grid/preview';

describe('forecast cache', () => {
  it('shares in-flight requests and reuses adjacent time frames', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({data: createPreviewGrid('wind', 0)})));
    const cache = createFrameCache(fetcher);
    const [first, repeated] = await Promise.all([cache.get('wind', 'GFS', 0), cache.get('wind', 'GFS', 0)]);
    expect(first).toBe(repeated);
    await cache.get('wind', 'GFS', 0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('bounds memory, separates models and retries failed requests', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({data: createPreviewGrid('wind', 0)})));
    const cache = createFrameCache(fetcher, 2);
    await cache.get('wind', 'GFS', 0);
    await cache.get('wind', 'ICON', 0);
    await cache.get('wind', 'GFS', 3);
    await cache.get('wind', 'GFS', 0);
    expect(fetcher).toHaveBeenCalledTimes(4);
    fetcher.mockResolvedValueOnce(new Response('', {status: 503}));
    await expect(cache.get('wind', 'GFS', 6)).rejects.toThrow();
    await cache.get('wind', 'GFS', 6);
    expect(fetcher).toHaveBeenCalledTimes(6);
  });

  it('expires cached runs and clamps the five day forecast window', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({data: createPreviewGrid('wind', 0)})));
    const cache = createFrameCache(fetcher, 12, 0);
    await cache.get('wind', 'GFS', 0);
    await cache.get('wind', 'GFS', 0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(forecastSteps(100)).toEqual({from:120, to:120, fraction:0});
    expect(forecastSteps(-1)).toEqual({from:0, to:3, fraction:0});
    expect(forecastSteps(1.25)).toEqual({from:0, to:3, fraction:.5});
  });
});

describe('GPU field input', () => {
  it('maps image rows to Web Mercator latitude, preserving the bounds', () => {
    expect(latitudeAt(48, 18, 0)).toBeCloseTo(48);
    expect(latitudeAt(48, 18, 1)).toBeCloseTo(18);
    expect(latitudeAt(48, 18, .5)).toBeGreaterThan(33);
  });

  it('makes dry rainfall and missing wave cells transparent', () => {
    for (const variable of ['rain', 'wave'] as const) {
      const frame = createPreviewGrid(variable === 'rain' ? 'wind' : 'wave', 0);
      frame.variable = variable;
      frame.values.fill(0);
      const raster = rasterizeGrid(frame, Array(8).fill('#ffffff'));
      expect(raster.data.filter((_, index) => index % 4 === 3).every(alpha => alpha === 0)).toBe(true);
    }
  });

  it('produces a bounded raster and retains exact interpolated forecast time', () => {
    const frame = createPreviewGrid('wind', 0);
    const raster = rasterizeGrid(frame, Array(10).fill('#ffffff'));
    expect(raster.data).toHaveLength(raster.width * raster.height * 4);
    expect(raster.data[(Math.floor(raster.height / 2) * raster.width + Math.floor(raster.width / 2)) * 4 + 3]).toBeGreaterThan(0);
    const next = {...frame, validAt: new Date(Date.parse(frame.validAt) + 10_800_000).toISOString()};
    expect(Date.parse(interpolateFrames(frame, next, .5).validAt) - Date.parse(frame.validAt)).toBe(5_400_000);
    expect(() => interpolateFrames(frame, {...next, runAt:'2000-01-01T00:00:00.000Z'}, .5)).toThrow();
  });
});
