import 'server-only';
import type {Confidence, Envelope, NormalizedMarine, NormalizedPoint, SourceMeta, WeatherBundle} from '@/types/domain';
import {withSourceCache} from './cache';
import {firstAvailable, isKoreanCoordinate} from './priority';
import {fetchKmaUltraObservation} from './kma/ultraNcst';
import {fetchOpenMeteoForecast} from './openmeteo/forecast';
import {fetchOpenMeteoMarine} from './openmeteo/marine';

function nowSeoul() {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  return `${shifted.slice(0, -1)}+09:00`;
}

function meta(source: string, sourceLabelKey: string, issuedAt: string, confidence: Confidence, ttl = 300): SourceMeta {
  return {source, sourceLabelKey, issuedAt, fetchedAt: nowSeoul(), confidence, cacheTtlSec: ttl, state: 'ready'};
}

export async function resolveCurrentPoint(options: {lat: number; lng: number; kmaKey?: string; fetcher?: typeof fetch; openPoint: NormalizedPoint}) {
  const candidates: Array<{name: string; load: () => Promise<NormalizedPoint>}> = [];
  if (options.kmaKey && isKoreanCoordinate(options.lat, options.lng)) candidates.push({name: 'KMA_ULTRA_NCST', load: () => fetchKmaUltraObservation(options.lat, options.lng, options.kmaKey!, options.fetcher)});
  candidates.push({name: 'OPEN_METEO', load: async () => options.openPoint});
  return firstAvailable(candidates);
}

export async function buildWeatherBundle(lat: number, lng: number, options: {kmaKey?: string; fetcher?: typeof fetch} = {}): Promise<WeatherBundle> {
  const open = await fetchOpenMeteoForecast(lat, lng, options.fetcher);
  const selected = await resolveCurrentPoint({lat, lng, kmaKey: options.kmaKey, fetcher: options.fetcher, openPoint: open.point});
  const pointConfidence: Confidence = selected.name === 'KMA_ULTRA_NCST' ? 'high' : 'medium';
  const point: Envelope<NormalizedPoint> = {data: selected.value,
    meta: meta(selected.name, selected.name === 'KMA_ULTRA_NCST' ? 'sources.kmaUltra' : 'sources.openMeteo', selected.value.time, pointConfidence),
    error: selected.fallbackDepth ? {code: 'PARTIAL_DATA', messageKey: 'errors.fallback', retryable: true} : null};
  const forecastMeta = meta('OPEN_METEO', 'sources.openMeteo', open.point.time, 'medium', 600);
  let marineData: NormalizedMarine;
  let marineMeta: SourceMeta;
  let marineError: Envelope<NormalizedMarine>['error'] = null;
  try {
    const marine = await fetchOpenMeteoMarine(lat, lng, options.fetcher);
    marineData = marine.marine;
    marineMeta = meta('OPEN_METEO_MARINE', 'sources.openMeteoMarine', marine.issuedAt, 'medium', 1800);
  } catch {
    marineData = {waveHeight: null, wavePeriod: null, waveDirection: null, swellHeight: null, seaTemperature: null, current: null, ripCurrentRisk: null};
    marineMeta = {...meta('UNAVAILABLE', 'sources.marine', nowSeoul(), 'diverging', 60), state: 'unavailable'};
    marineError = {code: 'UPSTREAM_UNAVAILABLE', messageKey: 'errors.marineUnavailable', retryable: true};
  }
  return {point, marine: {data: marineData, meta: marineMeta, error: marineError},
    hourly: {data: open.hourly.slice(0, 48), meta: forecastMeta, error: null},
    daily: {data: open.daily.slice(0, 15), meta: {...forecastMeta, cacheTtlSec: 2700}, error: null}};
}

export async function getWeatherBundle(lat: number, lng: number, fetcher?: typeof fetch) {
  const key = `weather:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  return withSourceCache(key, 300, () => buildWeatherBundle(lat, lng, {kmaKey: process.env.KMA_SERVICE_KEY, fetcher}));
}
