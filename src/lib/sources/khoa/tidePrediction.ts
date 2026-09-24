import {z} from 'zod';
import type {NormalizedTide} from '@/types/domain';
import type {TideStation} from '@/lib/tide/stations';
import {southSeaMulddae, tidePhase} from '@/lib/tide/calculate';
import {fetchParsed} from '../http';

const rawItem = z.object({tph_time: z.string(), tph_level: z.coerce.number(), hl_code: z.string()});
const responseSchema = z.object({result: z.object({data: z.array(rawItem)})});
export type KhoaTideItem = z.infer<typeof rawItem>;

function interpolateEvents(events: NormalizedTide['events'], date: string) {
  if (events.length < 2) return [];
  const points: NormalizedTide['series'] = [];
  for (let minute = 0; minute <= 24 * 60; minute += 10) {
    const at = Date.parse(`${date}T00:00:00+09:00`) + minute * 60_000;
    let rightIndex = events.findIndex(event => Date.parse(event.at) >= at);
    if (rightIndex < 0) rightIndex = events.length - 1;
    const leftIndex = Math.max(0, rightIndex - 1);
    const left = events[leftIndex];
    const right = events[rightIndex];
    const span = Math.max(1, Date.parse(right.at) - Date.parse(left.at));
    const ratio = Math.max(0, Math.min(1, (at - Date.parse(left.at)) / span));
    const eased = (1 - Math.cos(Math.PI * ratio)) / 2;
    points.push({at: new Date(at).toISOString(), level: Math.round((left.level + (right.level - left.level) * eased) * 100) / 100});
  }
  return points;
}

export function normalizeKhoaTide(items: KhoaTideItem[], station: TideStation, date: string, now = new Date()): NormalizedTide {
  const events = items.map(item => ({type: /고|high/i.test(item.hl_code) ? 'high' as const : 'low' as const,
    at: item.tph_time.includes('T') ? item.tph_time : `${item.tph_time.replace(' ', 'T')}+09:00`, level: item.tph_level / 100})).sort((a,b) => a.at.localeCompare(b.at));
  if (events.length < 2) throw new Error('KHOA tide events are incomplete');
  const series = interpolateEvents(events, date);
  const nearest = series.reduce((best, item) => Math.abs(Date.parse(item.at) - now.getTime()) < Math.abs(Date.parse(best.at) - now.getTime()) ? item : best, series[0]);
  return {stationId: station.stationId, stationName: station.stationName, distanceKm: station.distanceKm, tideSystem: station.tideSystem,
    current: {level: nearest.level, phase: tidePhase(series, now), at: nearest.at}, events, series,
    mulddae: southSeaMulddae(new Date(`${date}T12:00:00+09:00`)), sun: {rise: '06:20', set: '18:32'},
    moon: {rise: null, set: null, phase: 0}, seaTemperature: null, observed: false};
}

export async function fetchKhoaTidePrediction(station: TideStation, date: string, serviceKey: string, fetcher?: typeof fetch) {
  const params = new URLSearchParams({ServiceKey: serviceKey, ObsCode: station.stationId, Date: date.replaceAll('-', ''), ResultType: 'json'});
  const raw = await fetchParsed(`https://www.khoa.go.kr/api/oceangrid/tideObsPre/search.do?${params}`, responseSchema, {fetcher, circuitKey: 'khoa-tide-prediction'});
  return normalizeKhoaTide(raw.result.data, station, date);
}
