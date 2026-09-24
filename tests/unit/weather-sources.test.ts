import {beforeEach, describe, expect, it, vi} from 'vitest';
import {getSourceCacheStats, resetSourceCache, withSourceCache} from '../../src/lib/sources/cache';
import {firstAvailable, isKoreanCoordinate, selectWeatherSources} from '../../src/lib/sources/priority';
import {kmaCondition} from '../../src/lib/sources/kma/codes';
import {toKmaGrid} from '../../src/lib/sources/kma/grid';
import {fetchKmaUltraObservation, kmaObservationBase, normalizeKmaUltraObservation} from '../../src/lib/sources/kma/ultraNcst';
import {fetchKmaShortForecast, fetchKmaUltraForecast, normalizeKmaHourly} from '../../src/lib/sources/kma/forecast';
import {fetchOpenMeteoForecast, normalizeOpenMeteoForecast, weatherCode} from '../../src/lib/sources/openmeteo/forecast';
import {fetchOpenMeteoMarine, normalizeOpenMeteoMarine} from '../../src/lib/sources/openmeteo/marine';

describe('source priority and cache', () => {
  beforeEach(() => resetSourceCache());
  it('selects Korean sources by lead time', () => {
    expect(isKoreanCoordinate(33.46, 126.31)).toBe(true);
    expect(isKoreanCoordinate(35.68, 139.69)).toBe(false);
    expect(selectWeatherSources(0, true)[0]).toBe('KMA_ULTRA_NCST');
    expect(selectWeatherSources(6, true)[0]).toBe('KMA_ULTRA_FCST');
    expect(selectWeatherSources(24, true)[0]).toBe('KMA_SHORT_FCST');
    expect(selectWeatherSources(120, true)[0]).toBe('KMA_MID_FCST');
    expect(selectWeatherSources(300, false)).toEqual(['ECMWF', 'GFS']);
  });
  it('falls back after an injected upstream failure', async () => {
    const fallback = vi.fn(async () => 'open');
    const result = await firstAvailable([{name: 'kma', load: async () => { throw new Error('injected'); }}, {name: 'open', load: fallback}]);
    expect(result).toEqual({name: 'open', value: 'open', fallbackDepth: 1});
    expect(fallback).toHaveBeenCalledOnce();
  });
  it('fails when every source fails and evicts rejected cache loads', async () => {
    await expect(firstAvailable([{name: 'a', load: async () => { throw new Error('a'); }}])).rejects.toThrow('a');
    const loader = vi.fn(async () => { throw new Error('cache failure'); });
    await expect(withSourceCache('bad', 60, loader)).rejects.toThrow('cache failure');
    expect(getSourceCacheStats().entries).toBe(0);
  });
  it('caches identical requests and coalesces concurrent misses', async () => {
    const loader = vi.fn(async () => 42);
    const [first, samePending] = await Promise.all([withSourceCache('a', 60, loader), withSourceCache('a', 60, loader)]);
    const hit = await withSourceCache('a', 60, loader);
    expect([first.status, samePending.status, hit.status]).toEqual(['MISS', 'HIT', 'HIT']);
    expect(loader).toHaveBeenCalledOnce();
    expect(getSourceCacheStats()).toMatchObject({hits: 2, misses: 1, hitRate: 2 / 3});
  });
});

describe('KMA adapters', () => {
  it('converts WGS84 coordinates to the official KMA grid', () => {
    expect(toKmaGrid(37.5665, 126.978)).toEqual({nx: 60, ny: 127});
    expect(toKmaGrid(33.5, 126.5)).toEqual({nx: 52, ny: 38});
  });
  it('maps SKY and PTY codes in one table', () => {
    expect(kmaCondition(1, 0)).toBe('clear');
    expect(kmaCondition(3, 0)).toBe('partly');
    expect(kmaCondition(4, 1)).toBe('rain');
    expect(kmaCondition(4, 3)).toBe('snow');
  });
  it('normalizes ultra-short observations', () => {
    const base = {baseDate: '20260923', baseTime: '0900', nx: 50, ny: 38};
    const point = normalizeKmaUltraObservation([
      {...base, category: 'T1H', obsrValue: 23.4}, {...base, category: 'REH', obsrValue: 72},
      {...base, category: 'WSD', obsrValue: 4.8}, {...base, category: 'VEC', obsrValue: 270},
      {...base, category: 'UUU', obsrValue: 4.8}, {...base, category: 'VVV', obsrValue: 0},
      {...base, category: 'RN1', obsrValue: 1.2}, {...base, category: 'PTY', obsrValue: 1}
    ], 33.46, 126.31);
    expect(point).toMatchObject({temperature: 23.4, humidity: 72, condition: 'rain', wind: {speed: 4.8, direction: 270}, precipitation: {amount: 1.2, type: 'rain'}});
    expect(point.time).toBe('2026-09-23T09:00:00+09:00');
  });
  it('builds a base time and fetches an observation through the raw schema', async () => {
    expect(kmaObservationBase(new Date('2026-09-23T01:40:00Z'))).toEqual({baseDate: '20260923', baseTime: '0900'});
    const item = {baseDate: '20260923', baseTime: '0900', category: 'T1H', nx: 50, ny: 38, obsrValue: '23'};
    const fetcher = vi.fn(async () => new Response(JSON.stringify({response: {header: {resultCode: '00', resultMsg: 'NORMAL_SERVICE'}, body: {items: {item: [item]}}}}))) as unknown as typeof fetch;
    const point = await fetchKmaUltraObservation(33.46, 126.31, 'key', fetcher);
    expect(point.temperature).toBe(23);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('groups forecast categories by valid hour', () => {
    const base = {baseDate: '20260923', baseTime: '0830', fcstDate: '20260923'};
    const values = normalizeKmaHourly([
      {...base, fcstTime: '0900', category: 'T1H', fcstValue: 23}, {...base, fcstTime: '0900', category: 'SKY', fcstValue: 3},
      {...base, fcstTime: '0900', category: 'PTY', fcstValue: 0}, {...base, fcstTime: '0900', category: 'WSD', fcstValue: 4.2},
      {...base, fcstTime: '0900', category: 'VEC', fcstValue: 265}
    ]);
    expect(values[0]).toEqual({at: '2026-09-23T09:00:00+09:00', condition: 'partly', temperature: 23, windSpeed: 4.2, windDirection: 265});
  });
  it('fetches ultra and short forecast endpoints through the same normalizer', async () => {
    const item = {baseDate: '20260923', baseTime: '0800', fcstDate: '20260923', fcstTime: '0900', category: 'T1H', fcstValue: '24'};
    const fetcher = vi.fn(async () => new Response(JSON.stringify({response: {header: {resultCode: '00', resultMsg: 'NORMAL_SERVICE'}, body: {items: {item: [item]}}}}))) as unknown as typeof fetch;
    expect((await fetchKmaUltraForecast(33.46, 126.31, 'key', fetcher))[0].temperature).toBe(24);
    expect((await fetchKmaShortForecast(33.46, 126.31, 'key', fetcher))[0].temperature).toBe(24);
  });
});

describe('Open-Meteo adapters', () => {
  const raw = {
    current: {time: '2026-09-23T09:00', temperature_2m: 24, apparent_temperature: 25, relative_humidity_2m: 70,
      precipitation: 0, rain: 0, snowfall: 0, weather_code: 2, cloud_cover: 35, pressure_msl: 1013,
      visibility: 18000, wind_speed_10m: 5, wind_direction_10m: 270, wind_gusts_10m: 8},
    hourly: {time: ['2026-09-23T09:00'], temperature_2m: [24], apparent_temperature: [25], precipitation_probability: [10],
      precipitation: [0], weather_code: [2], wind_speed_10m: [5], wind_direction_10m: [270], uv_index: [4]},
    daily: {time: ['2026-09-23'], weather_code: [2], temperature_2m_max: [26], temperature_2m_min: [19],
      precipitation_sum: [0], precipitation_probability_max: [10], wind_speed_10m_max: [7],
      sunrise: ['2026-09-23T06:20'], sunset: ['2026-09-23T18:32']}
  };
  it('normalizes current, hourly and daily weather', () => {
    const result = normalizeOpenMeteoForecast(raw, 33.46, 126.31);
    expect(result.point).toMatchObject({temperature: 24, feelsLike: 25, condition: 'partly', visibility: 18, uvIndex: 4, wind: {speed: 5, direction: 270}});
    expect(result.point.wind?.u).toBe(5);
    expect(result.hourly[0].at).toBe('2026-09-23T09:00:00+09:00');
    expect(result.daily[0]).toMatchObject({temperatureMin: 19, temperatureMax: 26, sunrise: '2026-09-23T06:20:00+09:00'});
  });
  it('fetches and validates Open-Meteo weather', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(raw))) as unknown as typeof fetch;
    const result = await fetchOpenMeteoForecast(33.46, 126.31, fetcher);
    expect(result.hourly).toHaveLength(1);
  });
  it('maps WMO weather codes', () => {
    expect([weatherCode(0), weatherCode(2), weatherCode(45), weatherCode(63), weatherCode(75), weatherCode(82), weatherCode(96)])
      .toEqual(['clear', 'partly', 'fog', 'rain', 'snow', 'shower', 'thunder']);
  });
  it('normalizes marine values and converts current velocity to cm/s', () => {
    const marine = normalizeOpenMeteoMarine({current: {time: '2026-09-23T09:00', wave_height: .8, wave_direction: 315,
      wave_period: 8.2, swell_wave_height: .6, sea_surface_temperature: 24.1, ocean_current_velocity: 1.8, ocean_current_direction: 52}});
    expect(marine).toMatchObject({waveHeight: .8, wavePeriod: 8.2, seaTemperature: 24.1, current: {speed: 50, direction: 52}});
  });
  it('fetches and validates Open-Meteo marine data', async () => {
    const rawMarine = {current: {time: '2026-09-23T09:00', wave_height: .8, wave_direction: 315, wave_period: 8,
      swell_wave_height: .6, sea_surface_temperature: 24, ocean_current_velocity: null, ocean_current_direction: null}};
    const fetcher = vi.fn(async () => new Response(JSON.stringify(rawMarine))) as unknown as typeof fetch;
    const result = await fetchOpenMeteoMarine(33.46, 126.31, fetcher);
    expect(result.marine.current).toBeNull();
  });
});
