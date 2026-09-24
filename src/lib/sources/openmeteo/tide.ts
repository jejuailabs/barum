import {z} from 'zod';
import type {NormalizedTide} from '@/types/domain';
import type {TideStation} from '@/lib/tide/stations';
import {southSeaMulddae, tidePhase} from '@/lib/tide/calculate';
import {fetchParsed} from '../http';
import {seoulIso} from './forecast';

const numeric = z.number().nullable();
const schema = z.object({hourly: z.object({time: z.array(z.string()), sea_level_height_msl: z.array(numeric),
  sea_surface_temperature: z.array(numeric), ocean_current_velocity: z.array(numeric), ocean_current_direction: z.array(numeric)})});

export function normalizeOpenMeteoTide(raw: z.infer<typeof schema>, station: TideStation, date: string, now = new Date()): NormalizedTide {
  const series = raw.hourly.time.map((at, index) => ({at: seoulIso(at), level: raw.hourly.sea_level_height_msl[index]}))
    .filter((item): item is {at: string; level: number} => item.at.startsWith(date) && item.level !== null);
  if (series.length < 3) throw new Error('Marine tide series is incomplete');
  const events: NormalizedTide['events'] = [];
  for (let index = 1; index < series.length - 1; index += 1) {
    if (series[index].level >= series[index - 1].level && series[index].level > series[index + 1].level) events.push({type: 'high', ...series[index]});
    if (series[index].level <= series[index - 1].level && series[index].level < series[index + 1].level) events.push({type: 'low', ...series[index]});
  }
  const nearest = series.reduce((best, item) => Math.abs(Date.parse(item.at) - now.getTime()) < Math.abs(Date.parse(best.at) - now.getTime()) ? item : best, series[0]);
  const currentIndex = raw.hourly.time.findIndex(at => seoulIso(at) === nearest.at);
  return {stationId: station.stationId, stationName: station.stationName, distanceKm: station.distanceKm, tideSystem: station.tideSystem,
    current: {level: nearest.level, phase: tidePhase(series, now), at: nearest.at}, events, series,
    mulddae: southSeaMulddae(new Date(`${date}T12:00:00+09:00`)), sun: {rise: '06:20', set: '18:32'},
    moon: {rise: null, set: null, phase: 0}, seaTemperature: raw.hourly.sea_surface_temperature[currentIndex] ?? null, observed: false};
}

export async function fetchOpenMeteoTide(station: TideStation, date: string, fetcher?: typeof fetch) {
  const params = new URLSearchParams({latitude: String(station.lat), longitude: String(station.lng), timezone: 'Asia/Seoul', forecast_days: '7',
    hourly: 'sea_level_height_msl,sea_surface_temperature,ocean_current_velocity,ocean_current_direction'});
  const raw = await fetchParsed(`https://marine-api.open-meteo.com/v1/marine?${params}`, schema, {fetcher, circuitKey: 'open-meteo-tide'});
  return normalizeOpenMeteoTide(raw, station, date);
}
