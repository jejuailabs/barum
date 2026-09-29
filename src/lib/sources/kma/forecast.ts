import {z} from 'zod';
import type {HourlyPoint} from '@/types/domain';
import {fetchParsed} from '../http';
import {toKmaGrid} from './grid';
import {kmaCondition} from './codes';

const itemSchema = z.object({baseDate: z.string(), baseTime: z.string(), category: z.string(), fcstDate: z.string(), fcstTime: z.string(), fcstValue: z.union([z.number(), z.string()])});
const responseSchema = z.object({response: z.object({header: z.object({resultCode: z.string(), resultMsg: z.string()}), body: z.object({items: z.object({item: z.array(itemSchema)})}).optional()})});
export type KmaForecastItem = z.infer<typeof itemSchema>;

export function normalizeKmaHourly(items: KmaForecastItem[]): HourlyPoint[] {
  const groups = new Map<string, Record<string, number>>();
  for (const item of items) {
    const key = `${item.fcstDate}${item.fcstTime}`;
    const value = Number(item.fcstValue);
    if (Number.isFinite(value)) groups.set(key, {...groups.get(key), [item.category]: value});
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => ({
    at: `${key.slice(0,4)}-${key.slice(4,6)}-${key.slice(6,8)}T${key.slice(8,10)}:${key.slice(10,12)}:00+09:00`,
    condition: kmaCondition(values.SKY, values.PTY), temperature: values.T1H ?? values.TMP ?? 0,
    windSpeed: values.WSD ?? 0, windDirection: values.VEC ?? 0
  }));
}

export function ultraForecastBase(date = new Date()) {
  // KMA publishes HH30 forecasts for retrieval after HH45 in Korea.
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000 - 45 * 60 * 1000);
  const stamp = shifted.toISOString();
  return {baseDate: stamp.slice(0,10).replaceAll('-', ''), baseTime: `${stamp.slice(11,13)}30`};
}

function shortForecastBase(date = new Date()) {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000 - 15 * 60 * 1000);
  const hour = Math.floor((shifted.getUTCHours() + 1) / 3) * 3 - 1;
  const candidate = new Date(shifted);
  candidate.setUTCHours(hour < 0 ? 23 : hour, 0, 0, 0);
  if (candidate > shifted) candidate.setUTCHours(candidate.getUTCHours() - 3);
  return {baseDate: candidate.toISOString().slice(0,10).replaceAll('-', ''), baseTime: `${candidate.toISOString().slice(11,13)}00`};
}

async function fetchForecast(endpoint: 'getUltraSrtFcst' | 'getVilageFcst', lat: number, lng: number, serviceKey: string, fetcher?: typeof fetch) {
  const {nx, ny} = toKmaGrid(lat, lng);
  const {baseDate, baseTime} = endpoint === 'getUltraSrtFcst' ? ultraForecastBase() : shortForecastBase();
  const params = new URLSearchParams({serviceKey, pageNo: '1', numOfRows: '1000', dataType: 'JSON', base_date: baseDate, base_time: baseTime, nx: String(nx), ny: String(ny)});
  const raw = await fetchParsed(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${endpoint}?${params}`, responseSchema, {fetcher, circuitKey: `kma-${endpoint}`});
  if (raw.response.header.resultCode !== '00' || !raw.response.body) throw new Error(`KMA: ${raw.response.header.resultMsg}`);
  const items = raw.response.body.items.item;
  if (!items.length) throw new Error('KMA forecast is empty');
  const published = items[0];
  const issuedAt = `${published.baseDate.slice(0,4)}-${published.baseDate.slice(4,6)}-${published.baseDate.slice(6,8)}T${published.baseTime.slice(0,2)}:${published.baseTime.slice(2,4)}:00+09:00`;
  return {data: normalizeKmaHourly(items), issuedAt};
}

export const fetchKmaUltraForecastRun = (lat: number, lng: number, serviceKey: string, fetcher?: typeof fetch) => fetchForecast('getUltraSrtFcst', lat, lng, serviceKey, fetcher);
export const fetchKmaUltraForecast = async (lat: number, lng: number, serviceKey: string, fetcher?: typeof fetch) => (await fetchKmaUltraForecastRun(lat, lng, serviceKey, fetcher)).data;
export const fetchKmaShortForecast = async (lat: number, lng: number, serviceKey: string, fetcher?: typeof fetch) => (await fetchForecast('getVilageFcst', lat, lng, serviceKey, fetcher)).data;
