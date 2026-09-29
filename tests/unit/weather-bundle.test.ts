import {beforeEach, describe, expect, it, vi} from 'vitest';
import {getPhaseOneData} from '@/lib/sources/mock';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/sources/openmeteo/forecast', () => ({fetchOpenMeteoForecast:vi.fn()}));
vi.mock('@/lib/sources/openmeteo/marine', () => ({fetchOpenMeteoMarine:vi.fn()}));
vi.mock('@/lib/sources/kma/ultraNcst', () => ({fetchKmaUltraObservation:vi.fn()}));
vi.mock('@/lib/sources/kma/forecast', () => ({fetchKmaUltraForecastRun:vi.fn()}));

import {buildWeatherBundle} from '@/lib/sources/weather';
import {fetchOpenMeteoForecast} from '@/lib/sources/openmeteo/forecast';
import {fetchOpenMeteoMarine} from '@/lib/sources/openmeteo/marine';
import {fetchKmaUltraObservation} from '@/lib/sources/kma/ultraNcst';
import {fetchKmaUltraForecastRun} from '@/lib/sources/kma/forecast';

describe('weather bundle source attribution', () => {
  const fixture = getPhaseOneData();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchOpenMeteoForecast).mockResolvedValue({point:fixture.point.data, hourly:fixture.hourly, daily:fixture.daily});
    vi.mocked(fetchOpenMeteoMarine).mockResolvedValue({marine:fixture.marine.data, issuedAt:fixture.marine.meta.issuedAt});
    vi.mocked(fetchKmaUltraObservation).mockResolvedValue(fixture.point.data);
    vi.mocked(fetchKmaUltraForecastRun).mockResolvedValue({data:fixture.hourly.slice(0, 3), issuedAt:'2026-09-23T12:30:00+09:00'});
  });

  it('uses KMA ultra-short forecast for Korean places and keeps daily Open-Meteo provenance', async () => {
    const bundle = await buildWeatherBundle(33.46, 126.31, {kmaKey:'test-key'});
    expect(bundle.hourly.data).toHaveLength(3);
    expect(bundle.hourly.meta).toMatchObject({source:'KMA_ULTRA_FCST', sourceLabelKey:'sources.kmaUltraForecast', issuedAt:'2026-09-23T12:30:00+09:00'});
    expect(bundle.daily.meta.source).toBe('OPEN_METEO');
    expect(fetchKmaUltraForecastRun).toHaveBeenCalledOnce();
  });

  it('labels a failed KMA forecast as an Open-Meteo fallback', async () => {
    vi.mocked(fetchKmaUltraForecastRun).mockRejectedValue(new Error('upstream unavailable'));
    const bundle = await buildWeatherBundle(33.46, 126.31, {kmaKey:'test-key'});
    expect(bundle.hourly.data).toHaveLength(fixture.hourly.length);
    expect(bundle.hourly.meta.source).toBe('OPEN_METEO');
    expect(bundle.hourly.error?.code).toBe('PARTIAL_DATA');
  });

  it('does not request KMA forecasts outside Korea', async () => {
    const bundle = await buildWeatherBundle(35.67, 139.65, {kmaKey:'test-key'});
    expect(bundle.hourly.meta.source).toBe('OPEN_METEO');
    expect(fetchKmaUltraForecastRun).not.toHaveBeenCalled();
  });
});
