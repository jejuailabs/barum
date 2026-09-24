import {z} from 'zod';
import type {NormalizedPoint} from '@/types/domain';
import {fetchParsed} from '../http';
import {toKmaGrid} from './grid';
import {kmaCondition} from './codes';

const itemSchema = z.object({baseDate: z.string(), baseTime: z.string(), category: z.string(), nx: z.number(), ny: z.number(), obsrValue: z.coerce.number()});
const responseSchema = z.object({response: z.object({header: z.object({resultCode: z.string(), resultMsg: z.string()}), body: z.object({items: z.object({item: z.array(itemSchema)})}).optional()})});
export type KmaUltraObservation = z.infer<typeof itemSchema>;

function seoulParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function kmaObservationBase(date = new Date()) {
  const shifted = new Date(date.getTime() - 60 * 60 * 1000);
  const value = seoulParts(shifted);
  return {baseDate: `${value.year}${value.month}${value.day}`, baseTime: `${value.hour}00`};
}

export function normalizeKmaUltraObservation(items: KmaUltraObservation[], lat: number, lng: number): NormalizedPoint {
  if (!items.length) throw new Error('KMA observation is empty');
  const values = Object.fromEntries(items.map(item => [item.category, item.obsrValue])) as Record<string, number>;
  const speed = values.WSD;
  const direction = values.VEC ?? 0;
  const radians = direction * Math.PI / 180;
  const precipitationAmount = values.RN1 ?? 0;
  const pty = values.PTY ?? 0;
  const first = items[0];
  return {
    location: {lat, lng}, time: `${first.baseDate.slice(0,4)}-${first.baseDate.slice(4,6)}-${first.baseDate.slice(6,8)}T${first.baseTime.slice(0,2)}:${first.baseTime.slice(2,4)}:00+09:00`,
    temperature: values.T1H ?? null, feelsLike: null, condition: kmaCondition(undefined, pty), humidity: values.REH ?? null,
    pressure: null, visibility: null, uvIndex: null,
    wind: speed === undefined ? null : {speed, gust: null, direction, u: values.UUU ?? Math.round(-speed * Math.sin(radians) * 100) / 100, v: values.VVV ?? Math.round(-speed * Math.cos(radians) * 100) / 100},
    precipitation: {amount: precipitationAmount, probability: null, type: pty === 2 || pty === 3 || pty === 7 ? 'snow' : precipitationAmount > 0 ? 'rain' : null},
    sky: {cloudCover: null}
  };
}

export async function fetchKmaUltraObservation(lat: number, lng: number, serviceKey: string, fetcher?: typeof fetch) {
  const {nx, ny} = toKmaGrid(lat, lng);
  const {baseDate, baseTime} = kmaObservationBase();
  const params = new URLSearchParams({serviceKey, pageNo: '1', numOfRows: '1000', dataType: 'JSON', base_date: baseDate, base_time: baseTime, nx: String(nx), ny: String(ny)});
  const raw = await fetchParsed(`https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?${params}`, responseSchema, {fetcher, circuitKey: 'kma-ultra-ncst'});
  if (raw.response.header.resultCode !== '00' || !raw.response.body) throw new Error(`KMA: ${raw.response.header.resultMsg}`);
  return normalizeKmaUltraObservation(raw.response.body.items.item, lat, lng);
}
