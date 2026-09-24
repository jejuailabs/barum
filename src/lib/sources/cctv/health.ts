import type {CctvRecord, CctvStatus} from '@/types/domain';

export interface HealthState {status: CctvStatus; failCount: number; enabled: boolean; lastOkAt: string | null}

export function nextHealthState(previous: HealthState, ok: boolean, checkedAt = new Date().toISOString()): HealthState {
  if (ok) return {status: 'online', failCount: 0, enabled: true, lastOkAt: checkedAt};
  const failCount = previous.failCount + 1;
  return {status: failCount >= 3 ? 'offline' : 'degraded', failCount, enabled: failCount < 3, lastOkAt: previous.lastOkAt};
}

export async function probeHls(record: Pick<CctvRecord, 'hlsUrl' | 'rightsVerified'>, fetcher: typeof fetch = fetch) {
  if (!record.rightsVerified || !record.hlsUrl) return false;
  const response = await fetcher(record.hlsUrl, {headers: {range: 'bytes=0-2047'}, signal: AbortSignal.timeout(8_000)});
  if (!response.ok) return false;
  return (await response.text()).includes('#EXTM3U');
}
