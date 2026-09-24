import type {PhaseOneData} from '@/types/domain';

const issuedAt = '2026-09-22T09:00:00+09:00';
const fetchedAt = '2026-09-22T09:02:00+09:00';
const times = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

/** Phase 1 adapter. It matches the future live adapter contract and is the only mock boundary. */
export function getPhaseOneData(): PhaseOneData {
  const shared = {issuedAt, fetchedAt, cacheTtlSec: 300, state: 'ready' as const};
  return {
    spot: {id: 'aewol', nameKey: 'places.aewol', addressKey: 'places.aewolAddress', lat: 33.4621, lng: 126.3092, kind: 'rock'},
    point: {
      data: {
        location: {lat: 33.4621, lng: 126.3092, spotId: 'aewol'}, time: issuedAt,
        temperature: 23, feelsLike: 24, condition: 'partly', humidity: 66, pressure: 1014,
        visibility: 18, uvIndex: 5, wind: {speed: 4.8, gust: 7.1, direction: 270, u: 4.8, v: 0},
        precipitation: {amount: 0, probability: 10, type: null}, sky: {cloudCover: 34}
      },
      meta: {...shared, source: 'MOCK_KMA', sourceLabelKey: 'sources.weather', confidence: 'high'}, error: null
    },
    marine: {
      data: {waveHeight: 0.8, wavePeriod: 8.2, waveDirection: 315, swellHeight: 0.6,
        seaTemperature: 24.1, current: {speed: 31, direction: 52}, ripCurrentRisk: 'low'},
      meta: {...shared, source: 'MOCK_MARINE', sourceLabelKey: 'sources.marine', confidence: 'medium',
        station: {id: 'DT_MOCK', name: 'Aewol', distanceKm: 2.3}}, error: null
    },
    tide: {
      data: {
        stationId: 'DT_MOCK', stationName: 'Aewol', distanceKm: 2.3, tideSystem: 'west',
        current: {level: 1.34, phase: 'rising', at: issuedAt},
        events: [
          {type: 'high', at: '2026-09-22T07:42:00+09:00', level: 2.0},
          {type: 'low', at: '2026-09-22T13:51:00+09:00', level: 0.3},
          {type: 'high', at: '2026-09-22T20:16:00+09:00', level: 2.0}
        ],
        series: Array.from({length: 25}, (_, hour) => ({
          at: `2026-09-22T${String(hour).padStart(2, '0')}:00:00+09:00`,
          level: Math.round((1.15 + .82 * Math.sin((hour - 2) * Math.PI / 6.25)) * 100) / 100
        })),
        mulddae: {number: 8, label: '8', spring: false, neap: false},
        sun: {rise: '06:19', set: '18:34'}, moon: {rise: '14:02', set: null, phase: .58},
        seaTemperature: 24, observed: false
      },
      meta: {...shared, source: 'MOCK_KHOA', sourceLabelKey: 'sources.tide', confidence: 'high',
        station: {id: 'DT_MOCK', name: 'Aewol', distanceKm: 2.3}}, error: null
    },
    hourly: times.map((at, index) => ({at, condition: index < 5 ? 'partly' : 'cloudy',
      temperature: index > 1 && index < 5 ? 24 : 23, windSpeed: 4.8 - index * .28, windDirection: 270 - index * 8})),
    daily: Array.from({length: 15}, (_, index) => ({
      date: `2026-09-${String(22 + index).padStart(2, '0')}`, condition: index % 4 === 3 ? 'rain' as const : 'partly' as const,
      temperatureMin: 18 + index % 3, temperatureMax: 23 + index % 4, precipitationProbability: index % 4 === 3 ? 60 : 10,
      precipitationAmount: index % 4 === 3 ? 4.2 : 0, windSpeedMax: 6 + index % 3,
      sunrise: `2026-09-${String(22 + index).padStart(2, '0')}T06:19:00+09:00`, sunset: `2026-09-${String(22 + index).padStart(2, '0')}T18:34:00+09:00`
    })),
    advice: [
      {activity: 'surf', level: 'normal', titleKey: 'advice.surfNormal', reasonKey: 'advice.surfReason', params: {}, score: 68, confidence: 'medium'},
      {activity: 'fishing', level: 'good', titleKey: 'advice.fishingGood', reasonKey: 'advice.fishingReason', params: {}, score: 82, confidence: 'high'}
    ],
    recommendations: [
      {id: 'gwakji', category: 'surf', titleKey: 'recommend.gwakji', descriptionKey: 'recommend.gwakjiDescription', locationKey: 'recommend.gwakjiLocation', metrics: [
        {labelKey: 'metrics.wave', valueKey: 'recommend.waveOne'}, {labelKey: 'metrics.wind', valueKey: 'recommend.moderate'}, {labelKey: 'metrics.now', valueKey: 'recommend.temp23'}]},
      {id: 'dodu', category: 'drive', titleKey: 'recommend.dodu', descriptionKey: 'recommend.doduDescription', locationKey: 'recommend.doduLocation', metrics: [
        {labelKey: 'travel.sunset', valueKey: 'recommend.good'}, {labelKey: 'metrics.wind', valueKey: 'recommend.light'}, {labelKey: 'metrics.now', valueKey: 'recommend.temp22'}]},
      {id: 'hallim', category: 'fishing', titleKey: 'recommend.hallim', descriptionKey: 'recommend.hallimDescription', locationKey: 'recommend.hallimLocation', metrics: [
        {labelKey: 'tide.high', valueKey: 'recommend.highTime'}, {labelKey: 'travel.fishing', valueKey: 'recommend.fair'}, {labelKey: 'metrics.now', valueKey: 'recommend.temp21'}]}
    ]
  };
}
