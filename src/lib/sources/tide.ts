import 'server-only';
import type {Envelope, NormalizedTide, SourceMeta} from '@/types/domain';
import {getTideStation} from '@/lib/tide/stations';
import {withSourceCache} from './cache';
import {fetchKhoaTidePrediction} from './khoa/tidePrediction';
import {fetchOpenMeteoTide} from './openmeteo/tide';

function nowSeoul() {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  return `${shifted.slice(0, -1)}+09:00`;
}

export async function buildTideEnvelope(stationId: string, date: string, options: {khoaKey?: string; fetcher?: typeof fetch} = {}): Promise<Envelope<NormalizedTide>> {
  const station = getTideStation(stationId);
  if (options.khoaKey) {
    try {
      const tide = await fetchKhoaTidePrediction(station, date, options.khoaKey, options.fetcher);
      const meta: SourceMeta = {source: 'KHOA_TIDE_PRED', sourceLabelKey: 'sources.khoaTide', issuedAt: `${date}T00:00:00+09:00`, fetchedAt: nowSeoul(), confidence: 'high',
        station: {id: station.stationId, name: station.stationName, distanceKm: station.distanceKm}, cacheTtlSec: 86400, state: 'ready'};
      return {data: tide, meta, error: null};
    } catch {
      // The model fallback below is explicitly marked partial and never presented as official coastal tide data.
    }
  }
  const tide = await fetchOpenMeteoTide(station, date, options.fetcher);
  const meta: SourceMeta = {source: 'OPEN_METEO_TIDE_MODEL', sourceLabelKey: 'sources.openMeteoTide', issuedAt: `${date}T00:00:00+09:00`, fetchedAt: nowSeoul(), confidence: 'diverging',
    station: {id: station.stationId, name: station.stationName, distanceKm: station.distanceKm}, cacheTtlSec: 1800, state: 'partial'};
  return {data: tide, meta, error: {code: 'PARTIAL_DATA', messageKey: 'errors.tideModelFallback', retryable: true}};
}

export function getTideEnvelope(stationId: string, date: string, fetcher?: typeof fetch) {
  return withSourceCache(`tide:${stationId}:${date}`, 86400, () => buildTideEnvelope(stationId, date, {khoaKey: process.env.KHOA_SERVICE_KEY, fetcher}));
}
