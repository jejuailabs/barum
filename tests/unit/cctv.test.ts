import {describe, expect, it, vi} from 'vitest';
import {nextHealthState, probeHls, type HealthState} from '@/lib/sources/cctv/health';

describe('CCTV health', () => {
  it('degrades twice and disables on the third failure', () => {
    let state: HealthState = {status: 'online', failCount: 0, enabled: true, lastOkAt: null};
    state = nextHealthState(state, false);
    expect(state).toMatchObject({status: 'degraded', failCount: 1, enabled: true});
    state = nextHealthState(state, false);
    state = nextHealthState(state, false);
    expect(state).toMatchObject({status: 'offline', failCount: 3, enabled: false});
  });

  it('restores an online stream', () => {
    expect(nextHealthState({status: 'offline', failCount: 3, enabled: false, lastOkAt: null}, true, '2026-09-23T00:00:00Z')).toEqual({status: 'online', failCount: 0, enabled: true, lastOkAt: '2026-09-23T00:00:00Z'});
  });

  it('requires rights and a valid HLS manifest', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('#EXTM3U\n#EXT-X-VERSION:3'));
    expect(await probeHls({rightsVerified: false, hlsUrl: 'https://example.com/live.m3u8'}, fetcher)).toBe(false);
    expect(await probeHls({rightsVerified: true, hlsUrl: 'https://example.com/live.m3u8'}, fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
