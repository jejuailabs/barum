import type {CctvRecord} from '@/types/domain';

const providerPageUrl = 'https://www.jeju.go.kr/';

export const cctvSeed: CctvRecord[] = [
  ['hyeopjae', 33.3941, 126.2396, 'hyeopjae', ['beach', 'surf', 'swim']],
  ['gwakji', 33.4500, 126.3059, 'gwakji', ['beach', 'surf']],
  ['handam', 33.4592, 126.3102, 'aewol', ['coast', 'walk']],
  ['hallim-port', 33.4140, 126.2610, 'hallim', ['harbor', 'fishing']],
  ['aewol-port', 33.4664, 126.3203, 'aewol', ['harbor', 'fishing']],
  ['iho', 33.4970, 126.4523, 'iho', ['beach', 'swim']],
  ['hamdeok', 33.5434, 126.6697, 'hamdeok', ['beach', 'swim']],
  ['woljeong', 33.5565, 126.7958, 'woljeong', ['beach', 'surf']],
  ['seongsan', 33.4622, 126.9368, 'seongsan', ['harbor', 'sunrise']],
  ['jungmun', 33.2451, 126.4115, 'jungmun', ['beach', 'surf']]
].map(([id, lat, lng, linkedSpotId, tags], sortOrder) => ({
  id: String(id), nameKey: `cctv.registry.${id}`, lat: Number(lat), lng: Number(lng),
  providerKey: 'cctv.provider', attributionKey: 'cctv.attribution', providerPageUrl,
  linkedSpotId: String(linkedSpotId), tags: tags as string[], status: 'online',
  healthCheck: {lastOkAt: null, failCount: 0, avgStartMs: null}, enabled: true,
  sortOrder: (sortOrder + 1) * 10, rightsVerified: false, playbackMode: 'external'
}));
