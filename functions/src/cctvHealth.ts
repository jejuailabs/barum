import {nextHealthState, probeHls, type HealthState} from '../../src/lib/sources/cctv/health';
import type {CctvRecord} from '../../src/types/domain';

export async function evaluateCctv(record: CctvRecord): Promise<HealthState> {
  const ok = await probeHls(record);
  return nextHealthState({status: record.status, failCount: record.healthCheck.failCount, enabled: record.enabled, lastOkAt: record.healthCheck.lastOkAt}, ok);
}
