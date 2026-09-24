import {describe, expect, it} from 'vitest';
import {adaptParticleCount, initialParticleCount, interpolateFrames, sampleGrid} from '@/lib/grid/interpolate';
import {createPreviewGrid} from '@/lib/sources/grid/preview';

describe('grid pipeline', () => {
  it('creates the East Asia 161 by 121 grid contract', () => {
    const frame = createPreviewGrid('wind', 0);
    expect(frame.values).toHaveLength(19_481);
    expect(frame.u).toHaveLength(19_481);
    expect(frame.bounds).toEqual({west: 108, south: 18, east: 148, north: 48});
  });

  it('interpolates forecast steps and samples bilinearly', () => {
    const first = createPreviewGrid('temp', 0), second = createPreviewGrid('temp', 3);
    const middle = interpolateFrames(first, second, .5);
    expect(middle.values[20]).toBeCloseTo((first.values[20] + second.values[20]) / 2);
    expect(sampleGrid(middle, 126, 33.25)).toBeGreaterThan(10);
  });

  it('adapts particle density within safe limits', () => {
    expect(initialParticleCount(390)).toBe(4_000);
    expect(initialParticleCount(390, true)).toBe(0);
    expect(adaptParticleCount(4_000, 40)).toBe(3_000);
    expect(adaptParticleCount(28_000, 60)).toBe(30_000);
  });

  it('keeps model-specific preview fields and attribution distinct', () => {
    const gfs = createPreviewGrid('wind', 0, 'GFS');
    const ecmwf = createPreviewGrid('wind', 0, 'ECMWF');
    const icon = createPreviewGrid('wind', 0, 'ICON');
    expect([gfs.sourceLabelKey, ecmwf.sourceLabelKey, icon.sourceLabelKey]).toEqual([
      'sources.gfsPreview', 'sources.ecmwfPreview', 'sources.iconPreview'
    ]);
    expect(ecmwf.values[1]).not.toBe(gfs.values[1]);
    expect(icon.values[1]).not.toBe(ecmwf.values[1]);
  });
});
