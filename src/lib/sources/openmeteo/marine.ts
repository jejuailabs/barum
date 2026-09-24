import {z} from 'zod';
import type {NormalizedMarine} from '@/types/domain';
import {fetchParsed} from '../http';

const numeric = z.number().nullable();
export const openMeteoMarineSchema = z.object({current: z.object({
  time: z.string(), wave_height: numeric, wave_direction: numeric, wave_period: numeric,
  swell_wave_height: numeric, sea_surface_temperature: numeric,
  ocean_current_velocity: numeric, ocean_current_direction: numeric
})});
export type OpenMeteoMarineRaw = z.infer<typeof openMeteoMarineSchema>;

export function normalizeOpenMeteoMarine(raw: OpenMeteoMarineRaw): NormalizedMarine {
  const value = raw.current;
  return {
    waveHeight: value.wave_height, wavePeriod: value.wave_period, waveDirection: value.wave_direction,
    swellHeight: value.swell_wave_height, seaTemperature: value.sea_surface_temperature,
    current: value.ocean_current_velocity === null || value.ocean_current_direction === null ? null
      : {speed: Math.round(value.ocean_current_velocity / 0.036 * 10) / 10, direction: value.ocean_current_direction},
    ripCurrentRisk: null
  };
}

export async function fetchOpenMeteoMarine(lat: number, lng: number, fetcher?: typeof fetch) {
  const params = new URLSearchParams({latitude: String(lat), longitude: String(lng), timezone: 'Asia/Seoul', velocity_unit: 'kmh',
    current: 'wave_height,wave_direction,wave_period,swell_wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction'});
  const raw = await fetchParsed(`https://marine-api.open-meteo.com/v1/marine?${params}`, openMeteoMarineSchema, {fetcher, circuitKey: 'open-meteo-marine'});
  return {marine: normalizeOpenMeteoMarine(raw), issuedAt: `${raw.current.time}:00+09:00`};
}
